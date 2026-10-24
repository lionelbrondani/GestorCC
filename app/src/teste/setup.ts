import '@testing-library/jest-dom/vitest';

// No jsdom, o AbortSignal da janela não é aceito pelo Request do Node usado pelo roteador.
// Nos testes o cancelamento de navegação não importa, então o sinal é descartado.
const RequestOriginal = globalThis.Request;
class RequestSemSinal extends RequestOriginal {
  constructor(entrada: RequestInfo | URL, init?: RequestInit) {
    if (init?.signal) {
      const { signal: _sinal, ...resto } = init;
      super(entrada, resto);
    } else {
      super(entrada, init);
    }
  }
}
globalThis.Request = RequestSemSinal as typeof Request;
