/** Handles proxy HTML errors as well as the API's JSON validation errors. */
export async function calorieSaveError(response: Response): Promise<string> {
  if (response.status === 413) {
    return "Upload too large. Each image must be 8 MB or smaller; try smaller images or fewer images at once.";
  }
  if (response.status === 400) {
    try {
      const body = await response.json();
      if (typeof body.error === "string") return body.error;
    } catch { /* A proxy may return HTML instead of JSON. */ }
  }
  return "Couldn't save calories. Try again.";
}
