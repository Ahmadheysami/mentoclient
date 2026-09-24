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