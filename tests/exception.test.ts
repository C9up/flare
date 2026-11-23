import { describe, expect, expectTypeOf, it } from "vitest";
import {
	createError,
	Exception,
	format,
	InvalidArgumentsException,
	RuntimeException,
} from "../src/index.js";

describe("Exception", () => {
	it("reads code, status, help and message from the subclass statics", () => {
		class E_FILE_NOT_FOUND extends Exception {
			static override status = 404;
			static override code = "E_FILE_NOT_FOUND";
			static override help = "Check the path";
			static override message = "File not found";
		}
		const error = new E_FILE_NOT_FOUND();
		expect(error).toBeInstanceOf(Error);
		expect(error).toBeInstanceOf(Exception);
		expect(error).toMatchObject({
			name: "E_FILE_NOT_FOUND",
			message: "File not found",
			code: "E_FILE_NOT_FOUND",
			status: 404,
			help: "Check the path",
		});
	});

	it("lets the constructor override the message, the code and the status", () => {
		class Base extends Exception {
			static override code = "E_BASE";
		}
		const error = new Base("custom", { code: "E_OTHER", status: 409 });
		expect(error).toMatchObject({
			message: "custom",
			code: "E_OTHER",
			status: 409,
		});
	});

	it("defaults to status 500, no code and no help", () => {
		const error = new Exception("boom");
		expect(error.status).toBe(500);
		expect("code" in error).toBe(false);
		expect("help" in error).toBe(false);
		expect(error.toString()).toBe("Exception: boom");
	});

	it("keeps the cause", () => {
		const cause = new Error("root");
		expect(new Exception("wrapped", { cause }).cause).toBe(cause);
	});

	it("prints the code in toString and the class name as its tag", () => {
		class E_X extends Exception {
			static override code = "E_X";
		}
		const error = new E_X("bad");
		expect(error.toString()).toBe("E_X [E_X]: bad");
		expect(Object.prototype.toString.call(error)).toBe("[object E_X]");
	});

	it("starts the stack at the throw, not inside the constructor", () => {
		function thrower(): never {
			throw new RuntimeException("here");
		}
		try {
			thrower();
		} catch (error) {
			expect(error).toBeInstanceOf(RuntimeException);
			expect(String(error instanceof Error ? error.stack : "")).toContain(
				"thrower",
			);
		}
	});

	it("ships the two generic exceptions", () => {
		expect(new RuntimeException("x")).toMatchObject({
			code: "E_RUNTIME_EXCEPTION",
			status: 500,
		});
		expect(new InvalidArgumentsException("x")).toMatchObject({
			code: "E_INVALID_ARGUMENTS_EXCEPTION",
			status: 500,
		});
	});
});

describe("createError", () => {
	const E_RESOURCE_NOT_FOUND = createError<[number]>(
		"Unable to find resource with id %d",
		"E_RESOURCE_NOT_FOUND",
		404,
	);

	it("builds a class whose instances carry the code, the status and the formatted message", () => {
		const error = new E_RESOURCE_NOT_FOUND([42]);
		expect(error).toBeInstanceOf(E_RESOURCE_NOT_FOUND);
		expect(error).toBeInstanceOf(Exception);
		expect(error).toMatchObject({
			name: "Exception",
			message: "Unable to find resource with id 42",
			code: "E_RESOURCE_NOT_FOUND",
			status: 404,
		});
		expect(E_RESOURCE_NOT_FOUND.code).toBe("E_RESOURCE_NOT_FOUND");
		expect(E_RESOURCE_NOT_FOUND.status).toBe(404);
	});

	it("passes the cause through", () => {
		const cause = new Error("db down");
		expect(new E_RESOURCE_NOT_FOUND([1], { cause }).cause).toBe(cause);
	});

	it("defaults to status 500 and takes no arguments for a message without placeholders", () => {
		const E_NOT_BOOTED = createError("Used before boot", "E_NOT_BOOTED");
		const error = new E_NOT_BOOTED();
		expect(error).toMatchObject({
			message: "Used before boot",
			code: "E_NOT_BOOTED",
			status: 500,
		});
	});

	it("types the placeholder values", () => {
		expectTypeOf(E_RESOURCE_NOT_FOUND).constructorParameters.toEqualTypeOf<
			[args: [number], options?: ErrorOptions]
		>();
	});

	it("makes two classes from two calls, so instanceof tells them apart", () => {
		const A = createError("a", "E_A");
		const B = createError("b", "E_B");
		expect(new A()).not.toBeInstanceOf(B);
	});
});

describe("format", () => {
	it("fills each placeholder type", () => {
		expect(format("%s|%d|%i|%f|%j|%%", ["a", "4", 4.7, "1.5", { a: 1 }])).toBe(
			'a|4|4|1.5|{"a":1}|%',
		);
	});

	it("leaves a placeholder with no value and appends the values left over", () => {
		expect(format("%s and %s", ["one"])).toBe("one and %s");
		expect(format("value", ["extra", 2])).toBe("value extra 2");
	});

	it("writes objects, bigints, symbols and functions readably", () => {
		expect(format("%s", [{ a: 1 }])).toBe('{"a":1}');
		expect(format("%d %s", [10n, 5n])).toBe("10n 5n");
		expect(format("%s", [Symbol("x")])).toBe("Symbol(x)");
		expect(format("%o", [function named() {}])).toBe("[Function: named]");
		expect(format("%O", ["text"])).toBe("'text'");
	});

	it("does not loop on a circular object", () => {
		const loop: { self?: unknown } = {};
		loop.self = loop;
		expect(format("%j", [loop])).toBe('{"self":"[Circular]"}');
	});

	it("drops %c, which only styles a browser console", () => {
		expect(format("%cbold", ["color: red"])).toBe("bold");
	});
});
