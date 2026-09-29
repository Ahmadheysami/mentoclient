---
name: api-integration
description: Integrate a frontend feature with an existing API, making the decisions that determine whether the integration is correct, safe, and resilient — inspecting the API client, authentication, request patterns, response types, and error handling before writing any code, then handling every state (loading, success, empty, validation, authorization, network, and server errors). Enforces security and typing rules. Use when wiring a component or feature to an API, calling an endpoint, or handling API responses. For building new API endpoints use build-api; for auditing existing integrations use audit-api-integration.
---

# API Integration

Use existing API infrastructure.

Before implementation inspect:

- API client
- authentication
- request patterns
- response types
- error handling

## Handle

- loading
- success
- empty
- validation errors
- authorization errors
- network errors
- server errors

## Security

Never expose secrets.

Never treat client-side authorization as server authorization.

## Types

Prefer explicit request/response types.

Avoid `any`.