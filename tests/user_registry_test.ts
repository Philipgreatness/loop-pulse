import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.0.2/index.ts';

Clarinet.test({
  name: "User Registration: Successful registration with valid inputs",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const block = chain.mineBlock([
      Tx.contractCall('user_registry', 'register-user', 
        [
          types.ascii('TestUser'), 
          types.some(types.ascii('test@example.com'))
        ], 
        deployer.address
      )
    ]);

    block.receipts[0].result.expectOk().expectBool(true);
    
    // Verify user profile created
    const userProfile = chain.callReadOnlyFn(
      'user_registry', 
      'get-user-profile', 
      [types.principal(deployer.address)], 
      deployer.address
    );
    userProfile.result.expectSome();
  }
});

Clarinet.test({
  name: "User Registration: Prevent duplicate registrations",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const block = chain.mineBlock([
      Tx.contractCall('user_registry', 'register-user', 
        [
          types.ascii('TestUser'), 
          types.some(types.ascii('test@example.com'))
        ], 
        deployer.address
      ),
      // Second registration attempt
      Tx.contractCall('user_registry', 'register-user', 
        [
          types.ascii('DuplicateUser'), 
          types.some(types.ascii('duplicate@example.com'))
        ], 
        deployer.address
      )
    ]);

    // First registration should succeed
    block.receipts[0].result.expectOk().expectBool(true);
    
    // Second registration should fail
    block.receipts[1].result.expectErr().expectUint(409); // ERR_USER_ALREADY_EXISTS
  }
});

Clarinet.test({
  name: "User Registration: Input Validation - Username too short",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const block = chain.mineBlock([
      Tx.contractCall('user_registry', 'register-user', 
        [
          types.ascii('AB'), // Too short username
          types.some(types.ascii('test@example.com'))
        ], 
        deployer.address
      )
    ]);

    // Should fail with invalid input error
    block.receipts[0].result.expectErr().expectUint(400); // ERR_INVALID_INPUT
  }
});

Clarinet.test({
  name: "User Registration: Input Validation - Invalid Email",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const block = chain.mineBlock([
      Tx.contractCall('user_registry', 'register-user', 
        [
          types.ascii('ValidUser'), 
          types.some(types.ascii('invalid-email')) // Invalid email
        ], 
        deployer.address
      )
    ]);

    // Should fail with invalid input error
    block.receipts[0].result.expectErr().expectUint(400); // ERR_INVALID_INPUT
  }
});

Clarinet.test({
  name: "Update User Profile: Successful profile update",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const block = chain.mineBlock([
      // First, register the user
      Tx.contractCall('user_registry', 'register-user', 
        [
          types.ascii('InitialUser'), 
          types.some(types.ascii('initial@example.com'))
        ], 
        deployer.address
      ),
      // Then update profile
      Tx.contractCall('user_registry', 'update-user-profile', 
        [
          types.ascii('UpdatedUser'), 
          types.some(types.ascii('updated@example.com'))
        ], 
        deployer.address
      )
    ]);

    // First registration should succeed
    block.receipts[0].result.expectOk().expectBool(true);
    
    // Profile update should succeed
    block.receipts[1].result.expectOk().expectBool(true);

    // Verify updated profile
    const userProfile = chain.callReadOnlyFn(
      'user_registry', 
      'get-user-profile', 
      [types.principal(deployer.address)], 
      deployer.address
    );
    userProfile.result.expectSome();
  }
});

Clarinet.test({
  name: "Consent Management: Update consent",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const block = chain.mineBlock([
      // First, register the user
      Tx.contractCall('user_registry', 'register-user', 
        [
          types.ascii('ConsentUser'), 
          types.some(types.ascii('consent@example.com'))
        ], 
        deployer.address
      ),
      // Update consent to true
      Tx.contractCall('user_registry', 'update-consent', 
        [types.bool(true)], 
        deployer.address
      )
    ]);

    // First registration should succeed
    block.receipts[0].result.expectOk().expectBool(true);
    
    // Consent update should succeed
    block.receipts[1].result.expectOk().expectBool(true);

    // Verify consent given
    const consentStatus = chain.callReadOnlyFn(
      'user_registry', 
      'has-given-consent', 
      [types.principal(deployer.address)], 
      deployer.address
    );
    consentStatus.result.expectBool(true);
  }
});

Clarinet.test({
  name: "User Profile: Attempted update for non-existent user",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet_1 = accounts.get('wallet_1')!;
    const block = chain.mineBlock([
      // Try to update profile without registering first
      Tx.contractCall('user_registry', 'update-user-profile', 
        [
          types.ascii('UnregisteredUser'), 
          types.some(types.ascii('unregistered@example.com'))
        ], 
        wallet_1.address
      )
    ]);

    // Should fail with user not found error
    block.receipts[0].result.expectErr().expectUint(404); // ERR_USER_NOT_FOUND
  }
});