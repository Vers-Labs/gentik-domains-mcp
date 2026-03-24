/**
 * Lightweight HTTP client for the AgentDomains API.
 */
export declare class GentikClient {
    private baseUrl;
    private apiKey;
    constructor();
    private headers;
    get(path: string, auth?: boolean): Promise<unknown>;
    post(path: string, body: unknown, auth?: boolean): Promise<unknown>;
    private handleResponse;
}
//# sourceMappingURL=client.d.ts.map