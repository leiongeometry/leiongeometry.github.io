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
          <span>MATHEMATICAL NOTE</span>
          <strong>What changes—and what does not</strong>
          <i aria-hidden="true">+</i>
        </summary>

        <div className="metric-theory-body">
          <div className="metric-theory-lead">
            <p>
              Fix an abstract triangulation <em>T = (V, E, F)</em>. A metric is
              assigned intrinsically; the drawing in three-dimensional space is
              only a realization of that data. Throughout the demo, <em>T</em>
              {" "}stays fixed. The meaning of the metric—and therefore the correct
              way to draw it—changes from one view to the next.
            </p>
            <div className="metric-law">
              <span>GAUSS–BONNET</span>
              <strong>∫<sub>M∖V</sub> K dA + Σᵢ Kᵢ = 2πχ(M)</strong>
              <small>For constant face curvature κ, the integral is κA.</small>
            </div>
          </div>

          <div className="metric-theory-grid">
            <article>
              <span>01 · POLYHEDRAL METRIC</span>
              <h4>Euclidean triangles, glued edge to edge.</h4>
              <p>
                Positive edge lengths ℓᵢⱼ satisfying the triangle inequalities
                determine every face. Each face is flat; Gaussian curvature is
                concentrated at vertices:
              </p>
              <strong className="metric-formula">Kᵢ = 2π − Σ<sub>f∋i</sub> θᵢᶠ</strong>
            </article>

            <article>
              <span>02 · DISCRETE CONFORMAL SCALING</span>
              <h4>The metric changes through vertex scale factors.</h4>
              <p>
                Edge lengths evolve by a product of factors at their endpoints.
                The visual uses a one-parameter Möbius family, for which this
                relation is exact—not an arbitrary radial deformation.
              </p>
              <strong className="metric-formula">ℓ̃ᵢⱼ = e<sup>(uᵢ+uⱼ)/2</sup> ℓᵢⱼ</strong>
            </article>

            <article>
              <span>03 · IDEAL HYPERBOLIC LIFT</span>
              <h4>The conformal class becomes an ideal hyperbolic surface.</h4>
              <p>
                Each Euclidean face is replaced by an ideal triangle, and the
                logarithmic lengths become signed distances between horocycles
                in a decoration. The demo draws the underlying ideal
                triangulation in the Poincaré ball—geodesic edges are circular
                arcs orthogonal to its boundary—but omits the horocycles.
              </p>
              <strong className="metric-formula">λᵢⱼ = 2 log ℓᵢⱼ</strong>
            </article>

            <article>
              <span>04 · SPHERICAL UNIFORMIZATION</span>
              <h4>A genus-zero conformal class receives a spherical target.</h4>
              <p>
                The full algorithm finds a convex polyhedron whose vertices lie
                on S², giving a globally bijective discrete conformal map after
                radial projection. This symmetric example has a known target,
                so the demo displays it directly rather than running the
                numerical solver in the browser.
              </p>
              <strong className="metric-formula">Φ : (M, ℓ) → S²</strong>
            </article>
          </div>

          <div className="metric-theory-foot">
            <p>
              In the full algorithm, the triangulation may change at intrinsic
              Delaunay events. A diagonal flip obeys the Ptolemy relation
              <strong> ef = ac + bd</strong>. The animated metric change here is
              an exact Möbius family; the ideal and spherical views are faithful
              interpretations, not outputs of a browser-side solver.
            </p>
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
