import { siteConfig } from "@/lib/siteConfig";
import { landingContentService } from "@/services/LandingContentService";
import { Container } from "@/components/ui/Container";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";

/** Site footer — link columns, socials and copyright. */
export function Footer() {
  const footer = landingContentService.getFooter();

  return (
    <footer className="border-t border-border bg-surface/30">
      <Container className="py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="sm:col-span-2 lg:col-span-1">
            <Logo name={siteConfig.brand.name} />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {footer.tagline}
            </p>
            <ul className="mt-5 flex items-center gap-2">
              {footer.socials.map((social) => (
                <li key={social.label}>
                  <a
                    href={social.href}
                    aria-label={social.label}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground"
                  >
                    <Icon name={social.icon} className="h-4 w-4" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {footer.columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {column.title}
              </h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>{footer.copyright}</p>
          <a
            href="https://amaaniqbal.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-sm font-semibold text-foreground transition-colors hover:border-accent/60 hover:text-accent"
          >
            {footer.closingNote}
          </a>
        </div>
      </Container>
    </footer>
  );
}
