import { useEffect, useState } from "react";

const STORAGE_KEY = "skinops-theme";

export function applyTheme(theme: "light" | "dark") {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
}

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    try {
      const stored = (localStorage.getItem(STORAGE_KEY) as "light" | "dark" | null) ?? "light";
      setTheme(stored);
      applyTheme(stored);
    } catch {}
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };
  return { theme, toggle, setTheme: (t: "light" | "dark") => { setTheme(t); applyTheme(t); } };
}
