# Google Authentication Implementation Plan

## Research Summary (8/15 iterations used)

**Confidence**: HIGH - Found exact patterns and official Google documentation for Identity Services integration

**Key Findings**: 
- **Dependencies**: google-auth-library (installed), jsonwebtoken, @google-cloud/identity (new GIS library)
- **Architecture**: AWS Lambda backend with Express-like routing, Angular frontend with NgRx signals
- **Tech Stack**: Node.js, TypeScript, Angular 18, Material Design, AWS Lambda, DynamoDB
- **Patterns**: Follow auth pattern from `apps/backend/src/api/auth.ts`, use signal store pattern from `apps/frontend/src/store/user.store.ts`

**Critical Insights**:
- Google deprecated old Sign-In library, must use Google Identity Services (GIS)
- Current auth system has role-based access control but dummy authentication
- JWT should include organization and role info for existing auth logic integration
- Use RS256 asymmetric signing with AWS Secrets Manager for key storage

**Questions Asked** [3/3 REQUIRED]:
1. "Should I implement with the new GIS library or would you prefer a different approach?" → "yes go with google recommendation"
2. "Should the JWT I generate include the user's organization and role information?" → "keep org roles in the jwt"
3. "Would you prefer simple shared secret or asymmetric key signing (RS256)? What JWT expiration time?" → "yes. 1 week"

## POC Implementation Path Status: »» **NEXT PHASE TO IMPLEMENT**

### Unit 1: Google OAuth Setup & Secrets Configuration [Configure Google OAuth and AWS secrets] Status: ✅ **COMPLETED**

**Tags**:
- [DEMOABLE] - Can test Google Client ID configuration

**Complexity**: MICRO (1 point)
**Purpose**: Set up Google OAuth 2.0 credentials and AWS Secrets Manager for secure key storage

🔍 **Recommended Research Steps** (Perform these BEFORE implementation):

1. Google Cloud Console Setup:
   - Query: "Google Cloud Console OAuth 2.0 setup Angular web application"
   - Expected Result: Step-by-step guide for creating OAuth 2.0 credentials
   - Command: `mcp_brave-search_brave_web_search({ query: "Google Cloud Console OAuth 2.0 setup Angular web application 2024" })`

2. AWS Secrets Manager Configuration:
   - Query: "AWS Secrets Manager store RSA private key Node.js Lambda"
   - Key Focus: Best practices for storing asymmetric keys
   - Command: `mcp_brave-search_brave_web_search({ query: "AWS Secrets Manager store RSA private key Node.js Lambda best practices" })`

3. Environment Configuration:
   - Files to examine: `apps/frontend/src/environments/`, AWS deployment configuration
   - Patterns to identify: How environment variables are currently managed
   - Commands: `read_file()`, `grep_search({ query: "environment", include_pattern: "*.ts" })`

💡 **Developer Action**: Complete the above research steps before beginning implementation to ensure you have the same context and latest information.

**Changes** ✅ **COMPLETED**
- [x] Create Google OAuth 2.0 Client ID in Google Cloud Console
- [x] Generate RSA key pair for JWT signing
- [x] Store private key in AWS Secrets Manager with name `equip-track/jwt-private-key`
- [x] Add Google Client ID to environment configuration

**Success Criteria** ✅ **COMPLETED**
- [x] Google OAuth 2.0 Client ID generated and configured
- [x] RSA private key securely stored in AWS Secrets Manager
- [x] Environment variables properly configured for both frontend and backend

**Testing** ✅ **COMPLETED**
- [x] Verify Google Client ID is accessible in Angular environment
- [x] Test AWS Secrets Manager access from Lambda environment

**Implementation Notes**
- Use 2048-bit RSA key pair for RS256 signing
- Store public key for verification in environment or separate secret
- Follow existing environment pattern from `apps/frontend/src/environments/environment.ts`

## 🚀 Demoable Checkpoint: OAuth Configuration Complete

Google Client ID configured and can be accessed in development environment.

## MVP Implementation Path Status: ⚪ **NOT STARTED**

### Unit 2: Backend JWT Service [Create JWT generation and validation] Status: ⚪ **NOT STARTED** ← **NEXT UNIT**

**Complexity**: SMALL (2 points)  
**Purpose**: Implement JWT token generation and validation using RS256 with AWS Secrets Manager

🔍 **Recommended Research Steps** (Perform these BEFORE implementation):

1. Context7 Documentation Search:
   - Query: "jsonwebtoken RS256 asymmetric signing"
   - Expected Result: RS256 implementation patterns
   - Command: `mcp_context7_resolve-library-id({ libraryName: "jsonwebtoken" })`

2. AWS SDK Integration:
   - Query: "@aws-sdk/client-secrets-manager Node.js Lambda examples"
   - Key Focus: Caching strategies and error handling
   - Command: `mcp_brave-search_brave_web_search({ query: "@aws-sdk/client-secrets-manager Node.js Lambda examples caching" })`

3. Codebase Pattern Analysis:
   - Files to examine: `apps/backend/src/api/auth.ts`, existing service patterns
   - Patterns to identify: Service instantiation, error handling patterns
   - Commands: `read_file()`, `grep_search({ query: "class.*Service", include_pattern: "*.ts" })`

💡 **Developer Action**: Complete the above research steps before beginning implementation to ensure you have the same context and latest information.

**Changes**
- [ ] Install jsonwebtoken dependency in backend
- [ ] Create `src/services/jwt.service.ts` with RS256 signing
- [ ] Implement AWS Secrets Manager integration for private key retrieval
- [ ] Add JWT payload interface with user, organization, and role info
- [ ] Create token validation method with public key verification

**Success Criteria**
- [ ] JWT tokens generated with user, organization, and role claims
- [ ] Tokens signed with RS256 using private key from AWS Secrets Manager
- [ ] Token validation works with public key verification
- [ ] 1-week expiration properly set

**Testing**
[2 tests for SMALL complexity unit]
- [ ] Test JWT generation with mock user data
- [ ] Test JWT validation with generated token

**Implementation Notes**
- Cache private key in memory to avoid repeated Secrets Manager calls
- Include user ID, organization ID, role, and expiration in JWT payload
- Follow error handling pattern from existing auth.ts

### Unit 3: Backend Google Token Validation [Validate Google ID tokens] Status: ⚪ **NOT STARTED**

**Complexity**: STANDARD (4 points)
**Purpose**: Validate Google ID tokens and manage user lifecycle (create/update users)

🔍 **Recommended Research Steps** (Perform these BEFORE implementation):

1. Context7 Documentation Search:
   - Query: "google-auth-library OAuth2Client verifyIdToken"
   - Expected Result: Token verification patterns
   - Command: `mcp_context7_get-library-docs({ context7CompatibleLibraryID: "/googleapis/google-auth-library-nodejs", topic: "ID token verification" })`

2. User Management Research:
   - Files to examine: `apps/backend/src/db/tables/users-and-organizations.adapter.ts`
   - Patterns to identify: User creation, state management, organization linking
   - Commands: `read_file()`, `grep_search({ query: "createUser|updateUser", include_pattern: "*.ts" })`

3. API Endpoint Pattern:
   - Files to examine: `libs/shared/src/api/endpoints.ts`, handler patterns
   - Patterns to identify: Endpoint registration, request/response types
   - Commands: `read_file()`, `grep_search({ query: "endpointMetas", include_pattern: "*.ts" })`

💡 **Developer Action**: Complete the above research steps before beginning implementation to ensure you have the same context and latest information.

**Changes**
- [ ] Create `/api/auth/google` endpoint in shared endpoints
- [ ] Implement Google ID token validation using google-auth-library
- [ ] Add user lookup and creation logic in auth handler
- [ ] Update user state from Invited to Active
- [ ] Create users with Pending state when not found
- [ ] Generate and return JWT with user/organization info

**Success Criteria**
- [ ] Google ID tokens properly validated against Google's public keys
- [ ] Existing users with Invited state updated to Active
- [ ] New users created with Pending state
- [ ] JWT returned with user, organization, and role information
- [ ] Handles edge cases like invalid tokens gracefully

**Testing**
[4 tests for STANDARD complexity unit]
- [ ] Test valid Google ID token validation
- [ ] Test user state transition from Invited to Active
- [ ] Test new user creation with Pending state
- [ ] Test invalid token handling

**Implementation Notes**
- Use OAuth2Client from google-auth-library for token verification
- Follow existing adapter pattern from users-and-organizations.adapter.ts
- Return structured response with JWT and user info
- Handle Google API rate limits and network errors

## Enhancement Implementation Path Status: ⚪ **NOT STARTED**

### Unit 4: Frontend Google Identity Services Integration [Add Google Sign-In component] Status: ⚪ **NOT STARTED**

**Complexity**: STANDARD (4 points)
**Purpose**: Implement Google Sign-In using new Google Identity Services in Angular

🔍 **Recommended Research Steps** (Perform these BEFORE implementation):

1. Google Identity Services Research:
   - Query: "Google Identity Services Angular implementation credential response"
   - Key Focus: New GIS library integration patterns
   - Command: `mcp_brave-search_brave_web_search({ query: "Google Identity Services Angular implementation credential response 2024" })`

2. Angular Component Patterns:
   - Files to examine: `apps/frontend/src/ui/` component structure
   - Patterns to identify: Component creation, Material Design usage
   - Commands: `read_file()`, `grep_search({ query: "@Component", include_pattern: "*.ts" })`

3. GitHub Implementation Examples:
   - Repository: Angular Google Identity Services examples
   - Files to Examine: Component implementations, service integrations
   - Commands:
     - `mcp_gitmcp_search__7Brepo_7D_code({ query: "google identity services angular component" })`
     - `mcp_gitmcp_fetch_generic_url_content({ url: "found_example_file.ts" })`

💡 **Developer Action**: Complete the above research steps before beginning implementation to ensure you have the same context and latest information.

**Changes**
- [ ] Add Google Identity Services script to index.html
- [ ] Create `src/ui/auth/google-sign-in.component.ts` with Material Design
- [ ] Implement credential response handler
- [ ] Add Google Sign-In button with proper styling
- [ ] Handle sign-in success and error states

**Success Criteria**
- [ ] Google Sign-In button renders with proper branding
- [ ] Successfully captures Google ID token on sign-in
- [ ] Handles sign-in errors gracefully
- [ ] Follows Material Design patterns from existing components
- [ ] Integrates with Angular routing system

**Testing**
[4 tests for STANDARD complexity unit]
- [ ] Test component renders correctly
- [ ] Test successful sign-in flow
- [ ] Test error handling
- [ ] Test Material Design compliance

**Implementation Notes**
- Use Google Identity Services, not deprecated Sign-In library
- Follow component structure from existing UI components
- Use Material Design buttons and styling
- Handle credential response according to GIS documentation

### Unit 5: Frontend Auth Store & Service [Create authentication state management] Status: ⚪ **NOT STARTED**

**Complexity**: SMALL (3 points)
**Purpose**: Implement authentication state management and API service integration

🔍 **Recommended Research Steps** (Perform these BEFORE implementation):

1. NgRx Signals Pattern Analysis:
   - Files to examine: `apps/frontend/src/store/user.store.ts`
   - Patterns to identify: Signal store creation, methods, computed properties
   - Commands: `read_file()`, `grep_search({ query: "signalStore", include_pattern: "*.ts" })`

2. API Service Integration:
   - Files to examine: `apps/frontend/src/services/api.service.ts`
   - Patterns to identify: HTTP request patterns, error handling
   - Commands: `read_file()`, `grep_search({ query: "HttpClient", include_pattern: "*.ts" })`

3. Local Storage Patterns:
   - Query: "Angular localStorage JWT token secure storage best practices"
   - Key Focus: Secure storage and retrieval patterns
   - Command: `mcp_brave-search_brave_web_search({ query: "Angular localStorage JWT token secure storage best practices 2024" })`

💡 **Developer Action**: Complete the above research steps before beginning implementation to ensure you have the same context and latest information.

**Changes**
- [ ] Create `src/store/auth.store.ts` using NgRx signals pattern
- [ ] Add authentication methods to API service
- [ ] Implement JWT storage in localStorage
- [ ] Add auto-login on app initialization
- [ ] Create logout functionality with token cleanup

**Success Criteria**
- [ ] Auth state properly managed with NgRx signals
- [ ] JWT tokens stored securely in localStorage
- [ ] Auto-login works on page refresh
- [ ] Logout clears all authentication data
- [ ] Integrates with existing user store

**Testing**
[3 tests for SMALL complexity unit]
- [ ] Test authentication state changes
- [ ] Test localStorage integration
- [ ] Test auto-login functionality

**Implementation Notes**
- Follow signal store pattern from existing stores
- Use existing API service patterns
- Implement proper token expiration handling
- Clear sensitive data on logout

### Unit 6: Frontend Route Guards & Navigation [Protect routes and update navigation] Status: ⚪ **NOT STARTED**

**Complexity**: SMALL (2 points)
**Purpose**: Update route guards to use JWT authentication and modify navigation for auth state

🔍 **Recommended Research Steps** (Perform these BEFORE implementation):

1. Current Guard Pattern Analysis:
   - Files to examine: `apps/frontend/src/app/guards/role.guard.ts`
   - Patterns to identify: Guard implementation, role checking logic
   - Commands: `read_file()`, `grep_search({ query: "CanActivateFn", include_pattern: "*.ts" })`

2. Navigation Component Pattern:
   - Files to examine: `apps/frontend/src/ui/side-nav/`, `apps/frontend/src/ui/top-bar/`
   - Patterns to identify: Navigation rendering, user info display
   - Commands: `read_file()`, explore navigation components

3. Routing Configuration:
   - Files to examine: `apps/frontend/src/app/app.routes.ts`
   - Patterns to identify: Route protection, lazy loading patterns
   - Commands: `read_file()`, understand current routing setup

💡 **Developer Action**: Complete the above research steps before beginning implementation to ensure you have the same context and latest information.

**Changes**
- [ ] Update role.guard.ts to check JWT instead of mock user store
- [ ] Add authentication guard for login requirement
- [ ] Update top-bar to show user info from JWT
- [ ] Add sign-out button to navigation
- [ ] Handle unauthenticated state in navigation

**Success Criteria**
- [ ] Routes properly protected by JWT-based authentication
- [ ] Navigation shows authenticated user information
- [ ] Sign-out functionality works correctly
- [ ] Unauthenticated users redirected to login
- [ ] Role-based access control still functions

**Testing**
[2 tests for SMALL complexity unit]
- [ ] Test route protection with JWT
- [ ] Test navigation updates with auth state

**Implementation Notes**
- Preserve existing role-based guard logic
- Extract user info from JWT payload
- Follow existing guard patterns
- Update navigation components consistently

## Polish Implementation Path Status: ⚪ **NOT STARTED**

### Unit 7: ⚠️ Update Authentication System Integration [Replace dummy auth with JWT] Status: ⚪ **NOT STARTED**

**Tags**:
- [NEEDS_MORE_RESEARCH] - Need to verify all existing API endpoints work with JWT

**Complexity**: SMALL (3 points)
**Purpose**: Replace dummy authentication system with JWT-based authentication

**⚠️ WARNING MAY BREAK THE CODE**

🔍 **Recommended Research Steps** (Perform these BEFORE implementation):

1. Current Auth System Analysis:
   - Files to examine: `apps/backend/src/api/auth.ts`, all API handlers
   - Patterns to identify: How getUserId is currently used across endpoints
   - Commands: `grep_search({ query: "getUserId|authenticate", include_pattern: "*.ts" })`

2. JWT Integration Pattern:
   - Query: "Node.js Lambda JWT authorization header extraction best practices"
   - Key Focus: Header parsing, token validation in middleware
   - Command: `mcp_brave-search_brave_web_search({ query: "Node.js Lambda JWT authorization header extraction best practices" })`

3. API Gateway Integration:
   - Files to examine: API Gateway configuration, Lambda integration
   - Patterns to identify: How headers are passed to Lambda functions
   - Commands: Check AWS API Gateway setup, Lambda handler configuration

💡 **Developer Action**: Complete the above research steps before beginning implementation to ensure you have the same context and latest information.

**Changes**
- [ ] Update getUserId function in auth.ts to extract user ID from JWT
- [ ] Add JWT token validation to authentication middleware
- [ ] Update API Gateway to pass Authorization header to Lambda
- [ ] Test all existing endpoints with JWT authentication
- [ ] Add proper error handling for expired/invalid tokens

**Success Criteria**
- [ ] All existing API endpoints work with JWT authentication
- [ ] JWT tokens properly validated on each request
- [ ] User context correctly extracted from JWT payload
- [ ] Expired tokens handled gracefully
- [ ] Role-based access control preserved

**Testing**
[3 tests for SMALL complexity unit]
- [ ] Test endpoint access with valid JWT
- [ ] Test endpoint rejection with invalid JWT
- [ ] Test role-based access with JWT claims

**Implementation Notes**
- Preserve all existing role-based authorization logic
- Update only the user identification mechanism
- Ensure backward compatibility during transition
- Add comprehensive logging for debugging

**Breaking Change Mitigation**
- Migration strategy: Deploy with feature flag ENABLE_JWT_AUTH=false initially
- Rollback plan: Quick toggle back to dummy auth if issues arise
- Communication: Coordinate with frontend deployment
- Testing focus: Verify all user flows work with JWT authentication

### Unit 8: User Experience & Error Handling [Complete authentication UX] Status: ⚪ **NOT STARTED**

**Complexity**: SMALL (2 points)
**Purpose**: Enhance user experience with proper loading states, error handling, and pending user flow

**Changes**
- [ ] Add loading states during authentication process
- [ ] Create user-friendly error messages for auth failures
- [ ] Implement pending user state handling in frontend
- [ ] Add token refresh mechanism for expired JWTs
- [ ] Create comprehensive authentication documentation

**Success Criteria**
- [ ] Loading states provide clear user feedback
- [ ] Error messages are user-friendly and actionable
- [ ] Pending users see appropriate messaging
- [ ] Token refresh works seamlessly
- [ ] Documentation covers all authentication flows

**Testing**
[2 tests for SMALL complexity unit]
- [ ] Test loading states and error handling
- [ ] Test token refresh functionality

**Implementation Notes**
- Use Material Design loading indicators
- Follow existing error handling patterns
- Consider pending user onboarding flow
- Document security considerations

## 🚀 Demoable Checkpoint: Production-Ready Google Authentication

Complete Google authentication system with JWT, user management, and secure token handling. 

---

## CHECKPOINT: EquipTrack - Google Authentication - Unit 1 Complete

### MASTER PLAN STATUS

**Implementation Progress**:
[Original plan with checkboxes - only add ✓ for completed units]

1. POC Implementation Path
   - [x] Unit 1.1: Google OAuth Setup & Secrets Configuration ✓
   - [ ] Unit 2.1: Backend JWT Service ← NEXT UNIT
   - [ ] Unit 3.1: Backend Google Token Validation

### TECHNICAL CONTEXT

**Established Patterns**:

- **Environment Configuration**: Simple object with production flag, apiUrl, and now googleClientId
- **Script Pattern**: Node.js scripts in `/scripts` directory with proper error handling and logging
- **Dependencies**: Use npm for package management, AWS SDK v3 pattern already established
- **Security**: RSA key pair generation with 2048-bit keys, AWS Secrets Manager for secure storage

**Architecture**: AWS Lambda backend with Express-like routing, Angular 18 frontend with NgRx signals, AWS DynamoDB, Material Design

### COMPLETED UNIT

**Unit**: Google OAuth Setup & Secrets Configuration
**Files Modified**: 
- `apps/frontend/src/environments/environment.ts` - Added googleClientId
- `apps/frontend/src/environments/environment.prod.ts` - Added googleClientId placeholder
- `scripts/setup-jwt-secrets.js` - New RSA key management script
- `scripts/setup-google-oauth.md` - Complete OAuth setup documentation
- `apps/frontend/src/environments/environment.spec.ts` - Environment tests
- `package.json` - Added dependencies: jsonwebtoken, @aws-sdk/client-secrets-manager, @types/jsonwebtoken, google-auth-library

**Verification**: 
- Dependencies installed successfully
- RSA key pair generated (2048-bit)
- Environment configuration updated with placeholder
- Setup script created and tested for syntax
- Documentation provides clear OAuth setup steps

### NEXT UNIT SPECIFICATION

**Task**: Backend JWT Service [Create JWT generation and validation]
**Steps**: 
1. Study jsonwebtoken RS256 patterns via Context7
2. Examine AWS SDK Secrets Manager integration patterns
3. Analyze existing service patterns in codebase
4. Create `src/services/jwt.service.ts` with RS256 signing
5. Implement AWS Secrets Manager integration with caching
6. Add JWT payload interface with user/org/role info
7. Create token validation method
8. Write 2 unit tests

**Success Criteria**: JWT generation with RS256, AWS Secrets Manager integration, 1-week expiration, proper validation
**Pattern to Follow**: Service class pattern from existing codebase, error handling from auth.ts

---

Units: 1 completed | Next: SMALL complexity 