import MetricThought from "./MetricThought";
import ThemeToggle from "./ThemeToggle";

const publications = [
  {
    year: "2024",
    venue: "ACM TOG · SIGGRAPH ASIA",
    title: "PCO: Precision-Controllable Offset Surfaces with Sharp Features",
    authors: (
      <><strong>Lei Wang</strong>, Xudong Wang, Pengfei Wang, Shuangmin Chen, Shiqing Xin, Jiong Guo, Wenping Wang and Changhe Tu</>
    ),
    image: "/research/SIGGRAPHAsia2024PCO.webp",
    links: [
      ["Paper", "https://media.githubusercontent.com/media/Alan-Leo-Wong/SIGASIA24-PCO-ProjectPage/refs/heads/main/src/assets/PCO___SigAsia_2024_self.pdf?download=true"],
      ["Low-res PDF", "https://media.githubusercontent.com/media/Alan-Leo-Wong/SIGASIA24-PCO-ProjectPage/refs/heads/main/src/assets/PCO___SigAsia_2024_low_res_self.pdf?download=true"],
      ["Project page", "https://alan-leo-wong.github.io/SIGASIA24-PCO-ProjectPage/"],
      ["Code", "https://github.com/Alan-Leo-Wong/PCO"],
    ],
  },
  {
    year: "2024",
    venue: "PACIFIC GRAPHICS",
    title: "Mesh Slicing Along Isolines of Surface-Based Functions",
    authors: (
      <><strong>Lei Wang*</strong>, Xudong Wang*, Wensong Wang, Shuangmin Chen, Shiqing Xin, Changhe Tu and Wenping Wang <em>(* equal contribution)</em></>
    ),
    image: "/research/PG24.webp",
    links: [["Paper", "https://diglib.eg.org/server/api/core/bitstreams/d38ec3e7-05c2-4c56-b6b8-ffc1ac7c83c2/content"]],
  },
  {
    year: "2025",
    venue: "IEEE TVCG",
    title: "Towards Voronoi Diagrams of Surface Patches",
    authors: (
      <>Pengfei Wang, Jiantao Song, <strong>Lei Wang</strong>, Shiqing Xin, Xiaohong Jia, Dongming Yan, Shuangmin Chen, Changhe Tu and Wenping Wang</>
    ),
    image: "/research/towards_voronoi.webp",
    links: [["arXiv", "https://arxiv.org/abs/2411.06471"]],
  },
  {
    year: "2024",
    venue: "THE VISUAL COMPUTER",
    title: "ImS: Implicit Shell for the Sandwich-Walled Space Surrounding Polygonal Meshes",
    authors: (
      <>Huibiao Wen, <strong>Lei Wang</strong>, Shuangmin Chen, Shiqing Xin, Chongyang Deng, Changhe Tu, Ying He and Wenping Wang</>
    ),
    image: "/research/ims.webp",
    links: [["arXiv", "https://arxiv.org/abs/2411.01488"]],
  },
  {
    year: "2023",
    venue: "COMPUTER-AIDED DESIGN · SPM",
    title: "A Region-growing GradNormal Algorithm for Geometrically and Topologically Accurate Mesh Extraction",
    authors: (
      <>Chen Zong, Jinhui Zhao, <strong>Lei Wang</strong>, Pengfei Wang, Shuangmin Chen, Shiqing Xin, Yuanfeng Zhou, Changhe Tu and Wenping Wang</>
    ),
    image: "/research/2023SPMGradNormal.webp",
    links: [["Paper", "https://doi.org/10.1016/j.cad.2023.103559"]],
  },
];

const thoughts = [
  {
    number: "01",
    question: "How should metric structure guide geometric computation?",
    answer: "",
  },
  {
    number: "02",
    question: "Which structures should computation preserve?",
    answer: "Robust algorithms begin by deciding what is essential: metric, angle, topology, correspondence, or a deliberately chosen combination.",
  },
  {
    number: "03",
    question: "Where should learning end and geometry begin?",
    answer: "Learned priors can guide ambiguity; explicit geometry should still carry the invariants, constraints, and guarantees we care about.",
  },
  {
    number: "04",
    question: "When do different representations describe the same geometry?",
    answer: "Different representations can encode the same geometric object while organizing its information in incompatible ways. A learned map is meaningful only when it recovers their shared intrinsic structure, allowing computation to transfer without mistaking the carrier for the geometry.",
  },
];

function ExternalArrow() {
  return (
    <svg className="link-arrow" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path d="M2.75 9.25 9.25 2.75M4.25 2.75h5v5" />
    </svg>
  );
}

function DownArrow() {
  return (
    <svg className="link-arrow link-arrow--down" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path d="M6 1.75v8.5M2.75 7 6 10.25 9.25 7" />
    </svg>
  );
}

export default function App() {
  return (
    <main>
      <nav className="nav-shell" aria-label="Primary navigation">
        <a className="wordmark" href="#top" aria-label="Back to top">TO SEE CLEARLY.</a>
        <div className="nav-links">
          <a href="#about">ABOUT</a>
          <a href="#thoughts">THOUGHTS</a>
          <a href="#publications">PUBLICATIONS</a>
        </div>
        <ThemeToggle />
      </nav>

      <section className="hero" id="top">
        <div className="identity" id="about">
          <div className="identity-lead">
            <h1>Lei Wang</h1>
            <div className="coral-rule" />
            <h2>Geometry Processing · Intrinsic Geometry · Geometric Learning</h2>
          </div>

          <figure className="portrait-block">
            <img src="/lei-wang.jpg" alt="Portrait of Lei Wang" />
          </figure>

          <div className="hero-bio">
            <p>
              Hi, I’m Lei Wang <span className="chinese-name" lang="zh-CN">(王磊)</span>. I received my M.Eng. in Computer Technology from Shandong University, where I was supervised by <a href="https://irc.cs.sdu.edu.cn/~shiqing/index.html" target="_blank" rel="noreferrer">Prof. Shiqing Xin</a> and worked on geometry processing and robust geometric algorithms. I received my B.Eng. in Software Engineering from Harbin University of Science and Technology.
            </p>
            <p>
              My research interests include robust geometry, intrinsic representations, and geometry-aware learning, with a broader interest in how geometric information can move reliably across representations.
            </p>
          </div>
          <div className="hero-links">
            <a href="mailto:leiwangenesis@gmail.com">EMAIL <ExternalArrow /></a>
            <a href="https://github.com/Alan-Leo-Wong" target="_blank" rel="noreferrer">GITHUB <ExternalArrow /></a>
            <a href="https://scholar.google.com/citations?user=r25jWCUAAAAJ" target="_blank" rel="noreferrer">GOOGLE SCHOLAR <ExternalArrow /></a>
            <a href="https://www.linkedin.com/in/lei-wang-000b14286" target="_blank" rel="noreferrer">LINKEDIN <ExternalArrow /></a>
            <a href="https://x.com/SEVENTinTalent" target="_blank" rel="noreferrer">X <ExternalArrow /></a>
            <a href="#publications">PUBLICATIONS <DownArrow /></a>
          </div>
        </div>

        {/* Gallery is intentionally paused while its relationship to Thoughts is reconsidered.
        <div className="hero-gallery" id="metric">
          <MetricGallery />
        </div> */}
      </section>

      <section className="thoughts section-shell" id="thoughts">
        <header className="thought-heading">
          <h2>Thoughts</h2>
        </header>
        <div className="thought-list">
          {thoughts.map((thought, index) => (
            <details
              className={`thought-item${index === 0 ? " thought-item--metric" : ""}`}
              key={thought.number}
              open={index === 0 ? true : undefined}
            >
              <summary>
                <span>{thought.number}</span>
                <strong>{thought.question}</strong>
                <i aria-hidden="true">+</i>
              </summary>
              {index === 0 ? <MetricThought /> : <p>{thought.answer}</p>}
            </details>
          ))}
        </div>
        {/* The metric gallery may later become an interactive layer within this section. */}
      </section>

      <section className="publications section-shell" id="publications">
        <header className="publication-heading">
          <h2>Selected Publications</h2>
        </header>

        <div className="publication-list">
          {publications.map((publication, index) => (
            <article className="publication" key={publication.title}>
              <div className="publication-index">{String(index + 1).padStart(2, "0")}</div>
              <div className="publication-image">
                <img src={publication.image} alt="" loading="lazy" />
              </div>
              <div className="publication-copy">
                <p className="publication-meta"><span>{publication.venue}</span><span>{publication.year}</span></p>
                <h3>{publication.title}</h3>
                <p className="authors">{publication.authors}</p>
                <div className="paper-links">
                  {publication.links.map(([label, href]) => (
                    <a key={label} href={href} target="_blank" rel="noreferrer">{label} <ExternalArrow /></a>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer>
        <span>LEI WANG</span>
        <span>TO SEE CLEARLY.</span>
        <span>© {new Date().getFullYear()} LEI WANG. ALL RIGHTS RESERVED.</span>
      </footer>
    </main>
  );
}
