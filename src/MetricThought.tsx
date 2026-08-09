import LazyMetricGallery from "./LazyMetricGallery";

export default function MetricThought() {
  return (
    <div className="metric-thought">
      <div className="metric-copy">
        <p>
          A metric is not a pose of a mesh. It specifies lengths, angles, and
          curvature on an abstract triangulation; a visible shape is a separate
          choice of realization.
        </p>
        <p>
          The four views separate related geometric objects: a Euclidean
          polyhedral metric, a vertex-scaled metric in the same discrete
          conformal class, its ideal-hyperbolic interpretation, and a
          genus-zero spherical target.
        </p>
      </div>

      <article className="metric-realization">
        <LazyMetricGallery />
      </article>

      <details className="metric-theory">
        <summary>
          <span>NOTE</span>
          <strong>How to read the four views</strong>
          <i aria-hidden="true">+</i>
        </summary>

        <div className="metric-theory-body">
          <div className="metric-theory-grid">
            <article>
              <span>01 · POLYHEDRAL</span>
              <h4>Euclidean triangles joined edge to edge.</h4>
              <p>
                Edge lengths determine the flat faces. Curvature appears at the
                vertices as an angle defect.
              </p>
              <strong className="metric-formula">Kᵢ = 2π − Σ<sub>f∋i</sub> θᵢᶠ</strong>
            </article>

            <article>
              <span>02 · DISCRETE CONFORMAL</span>
              <h4>Rescale lengths at the vertices.</h4>
              <p>
                Vertex scale factors change the edge lengths while keeping the
                metric in the same discrete conformal class.
              </p>
              <strong className="metric-formula">ℓ̃ᵢⱼ = e<sup>(uᵢ+uⱼ)/2</sup> ℓᵢⱼ</strong>
            </article>

            <article>
              <span>03 · IDEAL HYPERBOLIC</span>
              <h4>Read the same conformal data hyperbolically.</h4>
              <p>
                Each face becomes an ideal triangle. Its logarithmic edge
                lengths give the signed distances between horocycles.
              </p>
              <strong className="metric-formula">λᵢⱼ = 2 log ℓᵢⱼ</strong>
            </article>

            <article>
              <span>04 · SPHERICAL</span>
              <h4>Uniformize a genus-zero surface onto S².</h4>
              <p>
                In this symmetric example the spherical target is known, so the
                demo can draw it directly.
              </p>
              <strong className="metric-formula">Φ : (M, ℓ) → S²</strong>
            </article>
          </div>

          <div className="metric-theory-foot">
            <p>
              Sources: <a href="https://markjgillespie.com/Research/CEPS/index.html" target="_blank" rel="noreferrer">Gillespie–Springborn–Crane (2021)</a>
              <span> · </span>
              <a href="https://arxiv.org/abs/1005.2698" target="_blank" rel="noreferrer">Bobenko–Pinkall–Springborn (2015)</a>
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}
