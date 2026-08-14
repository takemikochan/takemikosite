// 全ページ共通のスクロール登場演出。BaseLayout から 1 回だけ読み込む。
// IntersectionObserver 1 つで統一制御し、ページごと・コンポーネントごとに異なる仕組みを書かない。
const io = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        io.unobserve(entry.target); // 一度出たら監視終了。スクロールで往復しても再発火しない
      }
    }
  },
  { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
);

document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
