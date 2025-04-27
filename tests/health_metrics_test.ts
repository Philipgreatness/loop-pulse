import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.0.2/index.ts';

Clarinet.test({
  name: "User Registration in Health Metrics",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const block = chain.mineBlock([
      Tx.contractCall('health_metrics', 'register-user', [], deployer.address)
    ]);

    block.receipts[0].result.expectOk().expectBool(true);
  }
});

Clarinet.test({
  name: "Prevent Duplicate Health Metrics User Registration",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const block = chain.mineBlock([
      Tx.contractCall('health_metrics', 'register-user', [], deployer.address),
      Tx.contractCall('health_metrics', 'register-user', [], deployer.address)
    ]);

    // First registration should succeed
    block.receipts[0].result.expectOk().expectBool(true);
    
    // Second registration should fail
    block.receipts[1].result.expectErr().expectUint(1004); // ERR_ALREADY_REGISTERED
  }
});

Clarinet.test({
  name: "Log Health Metrics: Heart Rate",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const block = chain.mineBlock([
      // First register user
      Tx.contractCall('health_metrics', 'register-user', [], deployer.address),
      // Log heart rate metric
      Tx.contractCall('health_metrics', 'log-metric', 
        [
          types.uint(1), // METRIC_TYPE_HEART_RATE
          types.uint(75), 
          types.some(types.utf8('Resting heart rate'))
        ], 
        deployer.address
      )
    ]);

    // Registration should succeed
    block.receipts[0].result.expectOk().expectBool(true);
    
    // Metric logging should succeed
    block.receipts[1].result.expectOk().expectBool(true);
  }
});

Clarinet.test({
  name: "Log Health Metrics: Attempt without Registration",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet_1 = accounts.get('wallet_1')!;
    const block = chain.mineBlock([
      // Attempt to log metric without registration
      Tx.contractCall('health_metrics', 'log-metric', 
        [
          types.uint(1), // METRIC_TYPE_HEART_RATE
          types.uint(75), 
          types.some(types.utf8('Resting heart rate'))
        ], 
        wallet_1.address
      )
    ]);

    // Should fail due to not being registered
    block.receipts[0].result.expectErr().expectUint(1001); // ERR_NOT_REGISTERED
  }
});

Clarinet.test({
  name: "Log Health Metrics: Invalid Metric Type",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const block = chain.mineBlock([
      // First register user
      Tx.contractCall('health_metrics', 'register-user', [], deployer.address),
      // Log invalid metric type
      Tx.contractCall('health_metrics', 'log-metric', 
        [
          types.uint(99), // Invalid metric type
          types.uint(75), 
          types.some(types.utf8('Invalid metric'))
        ], 
        deployer.address
      )
    ]);

    // Registration should succeed
    block.receipts[0].result.expectOk().expectBool(true);
    
    // Metric logging should fail
    block.receipts[1].result.expectErr().expectUint(1003); // ERR_INVALID_METRIC
  }
});

Clarinet.test({
  name: "Share Metrics with Provider: Basic Scenario",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet_1 = accounts.get('wallet_1')!;
    const block = chain.mineBlock([
      // Register user
      Tx.contractCall('health_metrics', 'register-user', [], deployer.address),
      // Log some metrics
      Tx.contractCall('health_metrics', 'log-metric', 
        [
          types.uint(1), // METRIC_TYPE_HEART_RATE
          types.uint(75), 
          types.some(types.utf8('Resting heart rate'))
        ], 
        deployer.address
      ),
      // Share metrics with provider
      Tx.contractCall('health_metrics', 'share-metrics-with-provider', 
        [
          types.principal(wallet_1.address),
          types.list([types.uint(1)]), // Allowed heart rate metrics
          types.uint(1000) // Expiry block height
        ], 
        deployer.address
      )
    ]);

    // All steps should succeed
    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[1].result.expectOk().expectBool(true);
    block.receipts[2].result.expectOk().expectBool(true);
  }
});

Clarinet.test({
  name: "Retrieve User Metrics: Access Control",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet_1 = accounts.get('wallet_1')!;
    const block = chain.mineBlock([
      // Register user
      Tx.contractCall('health_metrics', 'register-user', [], deployer.address),
      // Log heart rate metric
      Tx.contractCall('health_metrics', 'log-metric', 
        [
          types.uint(1), // METRIC_TYPE_HEART_RATE
          types.uint(75), 
          types.some(types.utf8('Resting heart rate'))
        ], 
        deployer.address
      ),
      // Share metrics with wallet_1
      Tx.contractCall('health_metrics', 'share-metrics-with-provider', 
        [
          types.principal(wallet_1.address),
          types.list([types.uint(1)]), // Allowed heart rate metrics
          types.uint(1000) // Expiry block height
        ], 
        deployer.address
      )
    ]);

    // Verify metrics retrieval by wallet_1
    const metricsResult = chain.callReadOnlyFn(
      'health_metrics', 
      'get-user-metrics', 
      [
        types.principal(deployer.address), 
        types.uint(1) // Heart rate metric type
      ], 
      wallet_1.address
    );

    metricsResult.result.expectOk();
  }
});

Clarinet.test({
  name: "Revoke Provider Access",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet_1 = accounts.get('wallet_1')!;
    const block = chain.mineBlock([
      // Register user
      Tx.contractCall('health_metrics', 'register-user', [], deployer.address),
      // Share metrics with provider
      Tx.contractCall('health_metrics', 'share-metrics-with-provider', 
        [
          types.principal(wallet_1.address),
          types.list([types.uint(1)]), // Allowed heart rate metrics
          types.uint(1000) // Expiry block height
        ], 
        deployer.address
      ),
      // Revoke access
      Tx.contractCall('health_metrics', 'revoke-metric-access', 
        [types.principal(wallet_1.address)], 
        deployer.address
      )
    ]);

    // All steps should succeed
    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[1].result.expectOk().expectBool(true);
    block.receipts[2].result.expectOk().expectBool(true);
  }
});