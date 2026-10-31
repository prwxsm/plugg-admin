import type { AdminResult } from "../components/admin/model";
async function request<T>(path: string, data?: unknown): Promise<T> {
  const response = await fetch(`/api/admin/v1/${path}`, {
    method:data === undefined ? "GET" : "POST",
    credentials:"same-origin",
    headers: data === undefined ? {} : {"Content-Type":"application/json","X-Plugg-Admin":"1"},
    ...(data === undefined ? {} : {body:JSON.stringify(data)}),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "The Plugg backend could not complete the request.");
  return body as T;
}
export const getAdminSnapshot = () => request<AdminResult>("snapshot");
export const loginUser = ({data}: {data:{identifier:string;password:string}}) => request("login",data);
export const logoutUser = () => request("logout",{});
export const performAdminOperation = ({data}:{data:Record<string,unknown>}) => request("operations",data);
export const retryAdminAudio = ({data}:{data:{trackId:string}}) => request<{success:boolean;error?:string}>("retry-audio",data);
export const approveReleaseFn = ({data}:{data:{releaseId:string;newReleaseDate?:string}}) => request("review",{action:"approve",releaseId:data.releaseId,date:data.newReleaseDate});
export const requestChangesReleaseFn = ({data}:{data:{releaseId:string;feedback:string}}) => request("review",{action:"request_changes",...data});
