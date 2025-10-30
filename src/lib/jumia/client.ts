type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  refresh_expires_in?: number;
};

type RotateCallback = (refreshToken: string) => Promise<void>;

const isRetriableError = (message: string) => /(429|5\d\d|timeout|temporar)/i.test(message);

/**
 * Lightweight Fetch-powered client for the Jumia Vendor API.
 * Handles refresh-token grants, single-flight refreshes, token rotation,
 * and guarded retry with exponential backoff.
 */
export class JumiaClient {
  private accessToken: string | null = null;
  private refreshPromise: Promise<void> | null = null;

  constructor(
    private readonly apiBase: string,
    private readonly tokenUrl: string,
    private readonly clientId: string,
    private refreshToken: string,
    private readonly onRotate?: RotateCallback
  ) {}

  async getShops() {
    return this.call<{ shops: { id: string; name: string; email?: string }[] }>("/shops");
  }

  getOrders(params: {
    status?: string;
    shopId?: string;
    createdAfter?: string;
    createdBefore?: string;
    updatedAfter?: string;
    updatedBefore?: string;
    size?: number;
    token?: string;
    sort?: "ASC" | "DESC";
  }) {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.shopId) qs.set("shopId", params.shopId);
    if (params.createdAfter) qs.set("createdAfter", params.createdAfter);
    if (params.createdBefore) qs.set("createdBefore", params.createdBefore);
    if (params.updatedAfter) qs.set("updatedAfter", params.updatedAfter);
    if (params.updatedBefore) qs.set("updatedBefore", params.updatedBefore);
    if (params.size) qs.set("size", String(params.size));
    if (params.sort) qs.set("sort", params.sort);
    if (params.token) qs.set("token", params.token);
    const search = qs.toString();
    const path = `/orders${search ? `?${search}` : ""}`;
    return this.call<{
      orders: unknown[];
      nextToken?: string | null;
      isLastPage?: boolean;
    }>(path);
  }

  async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    await this.ensureAccessToken();
    const exec = async (): Promise<T> => {
      const url = `${this.apiBase.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
      const res = await fetch(url, {
        ...init,
        headers: {
          Accept: "application/json",
          ...(init.headers as Record<string, string> | undefined),
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (res.status === 401) {
        await this.ensureAccessToken(true);
        const retry = await fetch(url, {
          ...init,
          headers: {
            Accept: "application/json",
            ...(init.headers as Record<string, string> | undefined),
            Authorization: `Bearer ${this.accessToken}`,
          },
        });
        if (!retry.ok) {
          throw new Error(`${retry.status} ${await retry.text().catch(() => "")}`);
        }
        return this.parseBody<T>(retry);
      }

      if (!res.ok) {
        throw new Error(`${res.status} ${await res.text().catch(() => "")}`);
      }

      return this.parseBody<T>(res);
    };

    let attempt = 0;
    while (true) {
      try {
        return await exec();
      } catch (err) {
        const message = String((err as Error)?.message ?? "");
        if (attempt >= 5 || !isRetriableError(message)) {
          throw err;
        }
        const delay = Math.min(1200, Math.floor(300 * Math.pow(1.6, attempt)));
        await new Promise((resolve) => setTimeout(resolve, delay));
        attempt += 1;
      }
    }
  }

  private async ensureAccessToken(force = false) {
    if (!force && this.accessToken) return;
    if (!this.refreshPromise) {
      this.refreshPromise = this.refreshAccessToken().finally(() => {
        this.refreshPromise = null;
      });
    } else if (force) {
      // Force refresh by chaining a new refresh after current completes.
      this.refreshPromise = this.refreshPromise.then(() =>
        this.refreshAccessToken()
      ).finally(() => {
        this.refreshPromise = null;
      });
    }
    await this.refreshPromise;
  }

  private async refreshAccessToken() {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this.clientId,
      refresh_token: this.refreshToken,
    });

    const res = await fetch(this.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) {
      throw new Error(`Token error: ${res.status} ${await res.text().catch(() => "")}`);
    }

    const payload = (await res.json()) as TokenResponse;
    this.accessToken = payload.access_token;

    if (payload.refresh_token && payload.refresh_token !== this.refreshToken) {
      this.refreshToken = payload.refresh_token;
      if (this.onRotate) {
        await this.onRotate(payload.refresh_token);
      }
    }
  }

  private async parseBody<T>(res: Response): Promise<T> {
    if (res.status === 204) return {} as T;
    const text = await res.text();
    if (!text) return {} as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }
}
