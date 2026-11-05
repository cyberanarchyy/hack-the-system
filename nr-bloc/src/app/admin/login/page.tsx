"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <div className="mx-auto max-w-sm px-4 py-20 sm:px-6">
      <div className="panel-pink p-6 sm:p-8">
        <h1 className="text-xl text-white">
          Admin Login
        </h1>
        <form action={formAction} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-sm text-foreground-dim">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              className="border-2 border-line bg-background p-3 text-base text-foreground focus:border-cyan focus:outline-none"
            />
          </div>
          {state.error && <p className="text-sm text-red-300">{state.error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="btn btn-pink disabled:opacity-50"
          >
            {pending ? "Checking..." : "Log In"}
          </button>
        </form>
      </div>
    </div>
  );
}
