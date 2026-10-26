/** Arquivo escolhido pelo usuário → data URL (como a API recebe anexos). */
export const lerComoDataUrl = (f: File) =>
  new Promise<string>((ok, falha) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => falha(new Error('Não foi possível ler o arquivo.'));
    r.readAsDataURL(f);
  });

/** Baixa uma data URL com o nome dado. */
export function baixar(dataUrl: string, nome: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = nome;
  a.click();
}
