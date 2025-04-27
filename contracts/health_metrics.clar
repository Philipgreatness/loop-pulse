;; LoopPulse Health Metrics Contract
;; A secure, privacy-preserving blockchain-based health monitoring platform
;; Tracks user health metrics with strict privacy and consent controls

;; Error Codes
(define-constant ERR_NOT_REGISTERED u1001)
(define-constant ERR_UNAUTHORIZED u1002)
(define-constant ERR_INVALID_METRIC u1003)
(define-constant ERR_ALREADY_REGISTERED u1004)
(define-constant ERR_PROVIDER_NOT_AUTHORIZED u1005)

;; Metric Types Enum (using uint for type identification)
(define-constant METRIC_TYPE_HEART_RATE u1)
(define-constant METRIC_TYPE_STEPS u2)
(define-constant METRIC_TYPE_SLEEP u3)
(define-constant METRIC_TYPE_CALORIES u4)

;; User Registration Map
(define-map registered-users 
  principal 
  { 
    is-active: bool,
    consent-version: uint 
  }
)

;; Health Metrics Map
;; Uses a tuple to store complex metric information with immutability
(define-map user-metrics 
  { user: principal, metric-type: uint }
  (list 200 
    {
      timestamp: uint, 
      value: uint, 
      context: (optional (string-utf8 100))
    }
  )
)

;; Data Sharing Permissions Map
(define-map data-providers 
  { user: principal, provider: principal }
  {
    authorized: bool,
    allowed-metrics: (list 10 uint),
    expiry: uint
  }
)

;; Contract Owner
(define-data-var contract-owner principal tx-sender)

;; Authorization Check: Is User Registered
(define-private (is-registered (user principal))
  (match (map-get? registered-users user)
    user-data (get is-active user-data)
    false)
)

;; Authorization Check: Is Caller Contract Owner
(define-private (is-contract-owner)
  (is-eq tx-sender (var-get contract-owner))
)

;; Register User
(define-public (register-user)
  (begin
    (asserts! (not (is-registered tx-sender)) (err ERR_ALREADY_REGISTERED))
    (map-set registered-users tx-sender { is-active: true, consent-version: u1 })
    (ok true)
  )
)

;; Log Health Metric
(define-public (log-metric 
  (metric-type uint) 
  (value uint) 
  (context (optional (string-utf8 100)))
)
  (let 
    (
      (timestamp block-height)
      (current-metrics 
        (default-to 
          (list) 
          (map-get? user-metrics { user: tx-sender, metric-type: metric-type })
        )
    )
    ;; Validate metric type
    (asserts! 
      (or 
        (is-eq metric-type METRIC_TYPE_HEART_RATE)
        (is-eq metric-type METRIC_TYPE_STEPS)
        (is-eq metric-type METRIC_TYPE_SLEEP)
        (is-eq metric-type METRIC_TYPE_CALORIES)
      ) 
      (err ERR_INVALID_METRIC)
    )
    
    ;; Ensure user is registered
    (asserts! (is-registered tx-sender) (err ERR_NOT_REGISTERED))
    
    ;; Append new metric (maintaining immutability)
    (map-set user-metrics 
      { user: tx-sender, metric-type: metric-type }
      (unwrap! 
        (as-max-len? 
          (append current-metrics { 
            timestamp: timestamp, 
            value: value, 
            context: context 
          }) 
        u200) 
        (err ERR_INVALID_METRIC)
      )
    )
    (ok true)
  )
)

;; Get User Metrics
(define-read-only (get-user-metrics 
  (user principal) 
  (metric-type uint)
)
  (begin
    (asserts! (or (is-eq tx-sender user) (is-authorized-provider user tx-sender metric-type))
      (err ERR_UNAUTHORIZED))
    (ok (map-get? user-metrics { user: user, metric-type: metric-type }))
  )
)

;; Share Metrics with Provider
(define-public (share-metrics-with-provider 
  (provider principal) 
  (allowed-metrics (list 10 uint)) 
  (expiry uint)
)
  (begin
    (asserts! (is-registered tx-sender) (err ERR_NOT_REGISTERED))
    (map-set data-providers 
      { user: tx-sender, provider: provider }
      {
        authorized: true,
        allowed-metrics: allowed-metrics,
        expiry: expiry
      }
    )
    (ok true)
  )
)

;; Check if Provider is Authorized
(define-private (is-authorized-provider 
  (user principal) 
  (provider principal) 
  (metric-type uint)
)
  (match (map-get? data-providers { user: user, provider: provider })
    provider-data 
      (and 
        (get authorized provider-data)
        (< block-height (get expiry provider-data))
        (is-some (index-of (get allowed-metrics provider-data) metric-type))
      )
    false
  )
)

;; Revoke Provider Access
(define-public (revoke-metric-access (provider principal))
  (begin
    (asserts! (is-registered tx-sender) (err ERR_NOT_REGISTERED))
    (map-set data-providers 
      { user: tx-sender, provider: provider }
      {
        authorized: false,
        allowed-metrics: (list),
        expiry: u0
      }
    )
    (ok true)
  )
)

;; Owner can update contract owner
(define-public (update-contract-owner (new-owner principal))
  (begin
    (asserts! (is-contract-owner) (err ERR_UNAUTHORIZED))
    (var-set contract-owner new-owner)
    (ok true)
  )
)
)
