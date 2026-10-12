import type { Metadata, Viewport } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Deliberately using the system font stack instead of next/font/google's
// Geist/Geist Mono: this environment has no outbound access to
// fonts.googleapis.com, so every dev-server cold compile of this file (which
// every route depends on) was retrying and timing out on that fetch before
// falling back anyway — adding several seconds to every route's first load.
// System fonts render immediately with zero network dependency.

export const metadata: Metadata = {
  title: "Enterprise Inventory & Logistics Management System",
  description: "Inventory, stock, vehicle, driver and logistics management platform.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes sets the theme class on <html> before hydration, so React must not flag the mismatch.
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider delayDuration={200}>
            {children}
            <Toaster richColors position="top-right" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
