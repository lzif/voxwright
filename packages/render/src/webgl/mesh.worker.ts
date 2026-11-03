// SPDX-License-Identifier: AGPL-3.0-only

// Worker entry: the whole job is to feed messages to a `MeshService` and post
// its answers back, handing the mesh buffers over rather than copying them.

import { type MeshReply, type MeshRequest, MeshService, meshTransferList } from "../mesh/index.ts";

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<MeshRequest>) => void) | null;
  postMessage(message: MeshReply, transfer: Transferable[]): void;
};
const service = new MeshService();

scope.onmessage = (event) => {
  const reply = service.handle(event.data);
  if (reply !== null)
    scope.postMessage(reply, reply.type === "meshed" ? meshTransferList(reply.mesh) : []);
};
