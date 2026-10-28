import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";

/**
 * The public site shell.
 *
 * Header and Footer live here, once, so **no page builds its own** — which is
 * the Phase 1 rule and the thing that keeps 45 pages looking like one product.
 *
 * `<main id="main">` is here too, so the skip link in the root layout always
 * has a target and every page automatically has exactly one main landmark.
 */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}
