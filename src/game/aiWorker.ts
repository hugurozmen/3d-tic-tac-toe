import { resolveAiWorkerMessage } from './aiWorkerProtocol';

self.onmessage = (event: MessageEvent<unknown>) => {
  self.postMessage(resolveAiWorkerMessage(event.data));
};
