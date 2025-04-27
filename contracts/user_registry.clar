;; LoopPulse User Registry Contract
;; Secure, privacy-preserving user management for health monitoring platform

;; Error Codes
(define-constant ERR_UNAUTHORIZED u403)
(define-constant ERR_USER_ALREADY_EXISTS u409)
(define-constant ERR_USER_NOT_FOUND u404)
(define-constant ERR_INVALID_INPUT u400)

;; User Profile Structure
(define-map users 
  principal 
  {
    username: (string-ascii 50),
    email: (optional (string-ascii 100)),
    consent-given: bool,
    profile-updated-at: uint
  }
)

;; Private Helper Functions
(define-private (validate-username (username (string-ascii 50)))
  (and 
    (> (len username) u2)  ;; Minimum username length
    (<= (len username) u50)  ;; Maximum username length
  )
)

(define-private (validate-email (email (optional (string-ascii 100))))
  (match email
    valid-email 
      (and 
        (> (len valid-email) u5)  ;; Basic email validation
        (<= (len valid-email) u100)
      )
    true  ;; Optional emails are allowed
  )
)

;; User Registration Function
(define-public (register-user 
  (username (string-ascii 50))
  (email (optional (string-ascii 100)))
)
  (begin
    ;; Validate inputs
    (asserts! (validate-username username) (err ERR_INVALID_INPUT))
    (asserts! (validate-email email) (err ERR_INVALID_INPUT))

    ;; Check user doesn't already exist
    (asserts! (is-none (map-get? users tx-sender)) (err ERR_USER_ALREADY_EXISTS))

    ;; Register new user
    (map-insert users 
      tx-sender 
      {
        username: username, 
        email: email, 
        consent-given: false,
        profile-updated-at: block-height
      }
    )
    
    (ok true)
  )
)

;; Update User Profile
(define-public (update-user-profile 
  (new-username (string-ascii 50))
  (new-email (optional (string-ascii 100)))
)
  (let 
    (
      (existing-user (unwrap! (map-get? users tx-sender) (err ERR_USER_NOT_FOUND)))
    )
    ;; Input validation
    (asserts! (validate-username new-username) (err ERR_INVALID_INPUT))
    (asserts! (validate-email new-email) (err ERR_INVALID_INPUT))

    ;; Update user profile
    (map-set users 
      tx-sender 
      {
        username: new-username, 
        email: new-email, 
        consent-given: (get consent-given existing-user),
        profile-updated-at: block-height
      }
    )
    
    (ok true)
  )
)

;; Consent Management
(define-public (update-consent (consent bool))
  (let 
    (
      (existing-user (unwrap! (map-get? users tx-sender) (err ERR_USER_NOT_FOUND)))
    )
    (map-set users 
      tx-sender 
      (merge existing-user { consent-given: consent })
    )
    (ok true)
  )
)

;; Read-Only Functions
(define-read-only (get-user-profile (user principal))
  (map-get? users user)
)

(define-read-only (is-registered (user principal))
  (is-some (map-get? users user))
)

(define-read-only (has-given-consent (user principal))
  (match (map-get? users user)
    user-profile (get consent-given user-profile)
    false
  )
)