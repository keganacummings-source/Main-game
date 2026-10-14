import { DurableObject } from "cloudflare:workers";
import { AccountStore, type SigninResult, type SignupResult } from "./account-store.ts";
import type { Env } from "./env.ts";

/**
 * One Durable Object per username (named by the lowercased name), so the DO
 * name itself is the uniqueness constraint. Storage is the DO's own SQLite.
 */
export class UserAccount extends DurableObject<Env> {
  private store: AccountStore;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.store = new AccountStore(ctx.storage.sql);
  }

  signup(display: string, password: string): Promise<SignupResult> {
    return this.store.signup(display, password, Date.now());
  }

  signin(password: string): Promise<SigninResult> {
    return this.store.signin(password, Date.now());
  }

  verify(token: string): Promise<{ display: string } | null> {
    return this.store.verify(token, Date.now());
  }

  signout(token: string): Promise<void> {
    return this.store.signout(token);
  }

  async getSave(): Promise<{ payload: string; updatedAt: number } | null> {
    return this.store.getSave();
  }

  async putSave(payload: string): Promise<void> {
    this.store.putSave(payload, Date.now());
  }
}
