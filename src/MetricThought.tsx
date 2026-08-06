import MetricGallery from "./MetricGallery";

export default function MetricThought() {
  return (
    <div className="metric-thought">
      <p className="metric-copy">
        A representation does not, by itself, specify the geometry on which
        computation should operate. The metric determines which relations are
        intrinsic, and therefore what structure an algorithm can meaningfully
        preserve, compare, and propagate.
      </p>

      <article className="metric-realization">
        <MetricGallery />
      </article>
    </div>
  );
}
