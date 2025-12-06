const isProduction = Deno.env.get("ENVIRONMENT") === "production";

export class Logger {
  public static log(...args: unknown[]): void {
    if (isProduction) {
      return;
    }
    console.log(...args);
  }

  public static error(...args: unknown[]): void {
    if (isProduction) {
      return;
    }
    console.error(...args);
  }
}
