/**
 * Kleiner Haptik-Helfer.
 *
 * - Android/Chrome: navigator.vibrate mit abgestufter Dauer/Muster.
 * - iOS/Safari: kein vibrate(); Safari löst Systemhaptik aus, wenn ein
 *   <input type="checkbox" switch> per Label-Klick umgeschaltet wird
 *   (ab iOS 17.4). Dafür wird ein verstecktes Element einmalig angelegt.
 */

export type HapticPattern = number | number[];

let switchLabel: HTMLLabelElement | null = null;

const supportsVibrate = () =>
  typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

const supportsSwitch = () => {
  if (typeof document === "undefined") return false;
  try {
    return "switch" in document.createElement("input");
  } catch {
    return false;
  }
};

function ensureSwitch(): HTMLLabelElement | null {
  if (typeof document === "undefined") return null;
  if (switchLabel?.isConnected) return switchLabel;
  try {
    const label = document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    label.style.cssText =
      "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    switchLabel = label;
    return label;
  } catch {
    return null;
  }
}

/** Löst ein kurzes haptisches Feedback aus, wenn das Gerät es unterstützt. */
export function haptic(pattern: HapticPattern = 6): void {
  if (supportsVibrate()) {
    try {
      navigator.vibrate(pattern);
      return;
    } catch {
      /* ignore */
    }
  }
  if (!supportsSwitch()) return;
  const label = ensureSwitch();
  if (!label) return;
  try {
    label.click();
  } catch {
    /* ignore */
  }
}

/** True, wenn das Gerät überhaupt Haptik liefern kann. */
export function hapticsAvailable(): boolean {
  return supportsVibrate() || supportsSwitch();
}
