"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";

const MetricGallery = lazy(() => import("./MetricGallery"));

function MetricGalleryPlaceholder() {
  return (
    <section className="metric-gallery metric-gallery-loading" aria-label="Loading the interactive metric views">
      <div className="metric-stage metric-stage-loading">
        <div className="metric-topline">
          <span>GEOMETRIC REALIZATION</span>
          <span>T = (V, E, F)</span>
        </div>
        <div className="metric-loading-center" aria-hidden="true">
          <i />
          <span>LOADING GEOMETRY</span>
        </div>
      </div>
      <div className="metric-loading-control" aria-hidden="true" />
      <div className="metric-loading-index" aria-hidden="true">
        <i /><i /><i /><i />
      </div>
    </section>
  );
}

export default function LazyMetricGallery() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShouldLoad(true);
        observer.disconnect();
      },
      { rootMargin: "280px 0px" },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={hostRef}>
      {shouldLoad ? (
        <Suspense fallback={<MetricGalleryPlaceholder />}>
          <MetricGallery />
        </Suspense>
      ) : (
        <MetricGalleryPlaceholder />
      )}
    </div>
  );
}
