import { createServerFn } from "@tanstack/react-start";

/** Public switches the sign-in screen needs before anyone is signed in. */
export const getSiteOptions = createServerFn({ method: "GET" }).handler(async () => {
  const { mailConfigured } = await import("./mail.server");
  return { passwordReset: mailConfigured() };
});
