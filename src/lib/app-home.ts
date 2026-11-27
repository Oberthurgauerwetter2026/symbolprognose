/** Limit resume navigation to the main installed app's public product views. */
export function shouldResumeOnHome(standalone: boolean, pathname: string): boolean {
  return standalone && (pathname.startsWith('/karten/') || pathname === '/wetterbericht' || pathname === '/vertikalschnitt' || pathname === '/ticker');
}