/**
 * Flare: the exceptions of the ream ecosystem.
 *
 * Every package declares its errors with `createError()` and exports them as
 * an `errors` namespace, so an application can test `error.code` or
 * `error instanceof errors.E_SOMETHING`, and the HTTP exception handler can
 * read `error.status`. The shape follows `@poppinss/exception`, with one
 * difference: no Node.js import, so the same errors work in a browser and in
 * React Native.
 */

/** Options of an {@link Exception}: the standard `cause`, plus a code and a status. */
export interface ExceptionOptions extends ErrorOptions {
	code?: string;
	status?: number;
}

/** `Error.captureStackTrace` where the engine has it (V8, JavaScriptCore), else undefined. */
const captureStackTrace: unknown = Reflect.get(Error, "captureStackTrace");

/**
 * Base class of every ream error. A subclass sets its metadata once, as
 * static properties:
 *
 * ```ts
 * export class E_FILE_NOT_FOUND extends Exception {
 *   static status = 404
 *   static code = 'E_FILE_NOT_FOUND'
 *   static message = 'File not found'
 * }
 *
 * throw new E_FILE_NOT_FOUND()
 * ```
 */
export class Exception extends Error {
	/** Human-readable advice shown with the error, copied to each instance. */
	static help?: string;
	/** Machine-readable code, copied to each instance. */
	static code?: string;
	/** HTTP status the error maps to. Defaults to 500. */
	static status?: number;
	/** Message used when the constructor receives none. */
	static message?: string;

	/** Name of the class that raised the error. */
	override name: string;
	// Declared only, as upstream does: an error without a code or a help text
	// has no such property at all, rather than one holding undefined.
	/** Human-readable advice to fix the error. */
	declare help?: string;
	/** Machine-readable code: what an application branches on. */
	declare code?: string;
	/** HTTP status the error maps to. */
	status: number;

	constructor(message?: string, options?: ExceptionOptions) {
		super(message, options);
		const ErrorConstructor = new.target;
		this.name = ErrorConstructor.name;
		this.message = message || ErrorConstructor.message || "";
		this.status = options?.status || ErrorConstructor.status || 500;
		const code = options?.code || ErrorConstructor.code;
		if (code !== undefined) this.code = code;
		const help = ErrorConstructor.help;
		if (help !== undefined) this.help = help;
		if (typeof captureStackTrace === "function")
			captureStackTrace.call(Error, this, ErrorConstructor);
	}

	get [Symbol.toStringTag](): string {
		return this.constructor.name;
	}

	override toString(): string {
		if (this.code) return `${this.name} [${this.code}]: ${this.message}`;
		return `${this.name}: ${this.message}`;
	}
}

/** A function received arguments it cannot work with. */
export class InvalidArgumentsException extends Exception {
	static override code = "E_INVALID_ARGUMENTS_EXCEPTION";
	static override status = 500;
}

/** A failure at run time that no more specific error describes. */
export class RuntimeException extends Exception {
	static override code = "E_RUNTIME_EXCEPTION";
	static override status = 500;
}

/** The class {@link createError} returns. `T` lists the values of the message's placeholders. */
export interface ErrorClass<T extends unknown[]> {
	new (
		...params: [T] extends [never]
			? [args?: unknown[], options?: ErrorOptions]
			: [args: T, options?: ErrorOptions]
	): Exception;
	readonly prototype: Exception;
	code?: string;
	status?: number;
	message?: string;
	help?: string;
}

/**
 * Declares an error class in one line. The message may hold placeholders
 * (`%s`, `%d`, `%i`, `%f`, `%j`, `%o`, `%O`, `%%`), filled from the array the
 * constructor receives:
 *
 * ```ts
 * export const E_RESOURCE_NOT_FOUND = createError<[number]>(
 *   'Unable to find resource with id %d',
 *   'E_RESOURCE_NOT_FOUND',
 *   404,
 * )
 *
 * throw new E_RESOURCE_NOT_FOUND([42])
 * throw new E_RESOURCE_NOT_FOUND([42], { cause: error })
 * ```
 */
export function createError<T extends unknown[] = never>(
	message: string,
	code: string,
	status?: number,
): ErrorClass<T> {
	return class extends Exception {
		static override message = message;
		static override code = code;
		static override status = status;

		constructor(args?: unknown[], options?: ErrorOptions) {
			super(format(message, args ?? []), options);
			this.name = "Exception";
		}
	};
}

/**
 * Fills `%` placeholders the way Node.js `util.format` does, without
 * depending on Node.js. A placeholder with no value left stays as written;
 * values left over are appended, separated by spaces.
 */
export function format(template: string, args: readonly unknown[]): string {
	let next = 0;
	const out = template.replace(/%([sdifjoOc%])/g, (match, type: string) => {
		if (type === "%") return "%";
		if (next >= args.length) return match;
		const value = args[next++];
		switch (type) {
			case "s":
				return formatString(value);
			case "d":
				return formatNumber(value);
			case "i":
				return typeof value === "bigint"
					? `${value}n`
					: String(Number.parseInt(String(value), 10));
			case "f":
				return String(Number.parseFloat(String(value)));
			case "j":
				return safeJson(value);
			case "c":
				return "";
			default:
				return inspect(value);
		}
	});
	const rest = args
		.slice(next)
		.map((value) => (typeof value === "string" ? value : inspect(value)));
	return rest.length === 0 ? out : [out, ...rest].join(" ");
}

function formatString(value: unknown): string {
	if (typeof value === "bigint") return `${value}n`;
	if (typeof value === "symbol") return value.toString();
	if (value !== null && typeof value === "object" && !(value instanceof Error))
		return inspect(value);
	return String(value);
}

function formatNumber(value: unknown): string {
	if (typeof value === "bigint") return `${value}n`;
	if (typeof value === "symbol") return "NaN";
	return String(Number(value));
}

function inspect(value: unknown): string {
	if (typeof value === "string") return `'${value}'`;
	if (typeof value === "bigint") return `${value}n`;
	if (typeof value === "function")
		return `[Function: ${value.name || "(anonymous)"}]`;
	if (typeof value === "symbol" || value === undefined) return String(value);
	if (value instanceof Error)
		return value.stack ?? `${value.name}: ${value.message}`;
	return safeJson(value);
}

function safeJson(value: unknown): string {
	const seen = new WeakSet<object>();
	try {
		const json = JSON.stringify(value, (_key, inner: unknown) => {
			if (typeof inner === "bigint") return `${inner}n`;
			if (inner !== null && typeof inner === "object") {
				if (seen.has(inner)) return "[Circular]";
				seen.add(inner);
			}
			return inner;
		});
		return json ?? String(value);
	} catch {
		return "[Unserializable]";
	}
}
