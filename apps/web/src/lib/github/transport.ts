export function isGatewayError(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

/**
 * A relay can return an HTTP gateway error even when the browser can reach
 * GitHub. Try the other transport in that case, while preserving real GitHub
 * responses such as 401/403 for the normal error classifier.
 */
export async function fetchWithGatewayFallback(
  primary: () => Promise<Response>,
  fallback: () => Promise<Response>,
): Promise<Response> {
  let response: Response;
  try {
    response = await primary();
  } catch {
    return fallback();
  }
  if (!isGatewayError(response.status)) return response;

  try {
    const fallbackResponse = await fallback();
    return isGatewayError(fallbackResponse.status) ? response : fallbackResponse;
  } catch {
    return response;
  }
}
