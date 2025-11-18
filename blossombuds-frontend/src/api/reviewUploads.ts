// src/api/reviewUploads.ts
import adminHttp from "./adminHttp"; // or your public/authed axios; requires user JWT

export type PresignResponse = {
  key: string;         // e.g. uploads/tmp/uuid/file.heic
  url: string;         // presigned PUT url (10 min)
  contentType: string; // echoed back
};

export type FinalizeResponse = {
  id?: number;
  publicId?: string | null;
  url: string;            // final CDN/R2 GET url (no watermark)
  sortOrder?: number;
};

export async function presignReviewUpload(
  filename: string,
  contentType: string,
  authToken: string
) {
  const res = await fetch(apiUrl(`/api/reviews/images/presign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ filename, contentType }),
    credentials: "omit",
  }));
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { key: string; url: string; contentType: string };
}

// Low-level PUT (browser to R2) with progress
export async function putToPresignedUrl(
  url: string,
  file: File,
  onProgress?: (pct: number) => void
) {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) onProgress((e.loaded / e.total) * 100);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`PUT ${xhr.status}`));
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(file);
  });
}
export async function deleteTempUpload(key: string, authToken: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/reviews/images/tmp/delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ key }),
    credentials: "omit",
  }));
  if (!res.ok) throw new Error(await res.text());
}


/**
 * Ask backend to read the temp object, normalize (HEIC→JPEG), store final,
 * and return a permanent URL (no watermark for reviews).
 */
export async function finalizeReviewImage(tempKey: string, sortOrder?: number) {
  const { data } = await adminHttp.post<FinalizeResponse>(
    `/api/reviews/images/finalize`,
    { tempKey, sortOrder }
  );
  return data;
}
export async function attachImageFromTempKey(
  reviewId: number,
  key: string,
  authToken: string
) {
  const res = await fetch(apiUrl(`/api/reviews/${reviewId}/images/attach`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ key }),
    credentials: "omit",
  }));
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as {
    id: number;
    publicId: string;
    url: string;       // signed GET (30 min)
    sortOrder: number;
  };
}