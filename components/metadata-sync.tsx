"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  pageTitles,
  siteDescriptions,
  type PagePath,
} from "@/lib/page-metadata";

export function MetadataSync() {
  const pathname = usePathname();

  useEffect(() => {
    const updateMetadata = () => {
      const language =
        document.documentElement.dataset.language === "ua" ? "ua" : "en";
      const title = pageTitles[pathname as PagePath] ?? pageTitles["/"];
      let description = document.querySelector<HTMLMetaElement>(
        'meta[name="description"]',
      );

      document.title = title[language];

      if (!description) {
        description = document.createElement("meta");
        description.name = "description";
        document.head.appendChild(description);
      }

      description.content = siteDescriptions[language];
    };

    updateMetadata();

    const observer = new MutationObserver(updateMetadata);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-language"],
    });

    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
