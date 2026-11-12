"use client";

import { ThemeProvider as NextThemeProvider } from "next-themes";
import type { ComponentProps } from "react";

export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemeProvider>) {
  return (
    <NextThemeProvider attribute="class" themes={["light", "dark", "matrix"]} defaultTheme="light" {...props}>
      {children}
    </NextThemeProvider>
  );
}
