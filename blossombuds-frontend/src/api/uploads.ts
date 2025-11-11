// src/api/uploads.ts
import adminHttp from "./adminHttp";

export type Presign = {
  key: string;         // tmp/<uuid>/<sanitized-filename>
  url: string;         // presigned PUT URL
  contentType: string; // what server expects in PUT header
};

export async function presignUpload(filename: string, contentType?: string): Promise<Presign> {
  const { data } = await adminHttp.post<Presign>(
    "/api/catalog/uploads/presign",
    null,
    {
      params: {
        filename,
        contentType: contentType && contentType.trim() ? contentType : "application/octet-stream",
      },
    }
  );
  return data;
}
