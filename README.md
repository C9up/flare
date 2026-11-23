# @c9up/flare

The exceptions of the ream ecosystem. Every `@c9up` package declares its errors with flare, so an
application handles them all the same way: test `error.code`, or `error instanceof errors.E_…`.

No dependency. Runs in Node.js, in browsers and in React Native.

## Install

```sh
pnpm add @c9up/flare
```

## Declare an error

`createError()` declares an error class in one line: a message, a code, and an HTTP status (500 by
default).

```ts
// src/errors.ts
import { createError } from '@c9up/flare'

export const E_RESOURCE_NOT_FOUND = createError<[number]>(
  'Unable to find resource with id %d',
  'E_RESOURCE_NOT_FOUND',
  404,
)
```

The values of the placeholders (`%s`, `%d`, `%j`…) are passed as an array:

```ts
throw new E_RESOURCE_NOT_FOUND([42])
// Exception [E_RESOURCE_NOT_FOUND]: Unable to find resource with id 42

throw new E_RESOURCE_NOT_FOUND([42], { cause: error })
```

When an error needs to carry data, extend `Exception` and set its metadata as static properties:

```ts
import { Exception } from '@c9up/flare'

export class E_ROW_NOT_FOUND extends Exception {
  static status = 404
  static code = 'E_ROW_NOT_FOUND'
  static message = 'Row not found'

  constructor(public model: string) {
    super()
  }
}
```

## Handle an error

A package exports its errors as one namespace:

```ts
// src/index.ts
export * as errors from './errors.js'
```

```ts
import { errors } from '@c9up/some-package'

try {
  await findResource(42)
} catch (error) {
  if (error instanceof errors.E_RESOURCE_NOT_FOUND) {
    // …
  }
}
```

Every instance has:

| Property | Description |
|---|---|
| `code` | The machine-readable code, such as `E_RESOURCE_NOT_FOUND` |
| `status` | The HTTP status the error maps to (500 by default) |
| `message` | The message, with its placeholders filled |
| `help` | Advice to fix the error, when the class defines one |
| `cause` | The error that caused this one, when given |

`RuntimeException` (`E_RUNTIME_EXCEPTION`) and `InvalidArgumentsException`
(`E_INVALID_ARGUMENTS_EXCEPTION`) cover failures that no more specific error describes.

## License

MIT
