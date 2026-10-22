import type { AuthPayload } from "../domain/users/types/User.js";
declare global { namespace Express { interface Request { user?: AuthPayload } } }
export {};
