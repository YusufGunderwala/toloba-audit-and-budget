import './TreasuryLoader.css';

const sparkAngles = [-154, -132, -111, -90, -69, -48, -26];

export default function TreasuryLoader({ label = 'Loading treasury data…' }) {
  return (
    <div role="status" className="grid min-h-full place-items-center py-4">
      <div className="grid w-full justify-items-center text-center">
        <div className="treasury-loader-scene" aria-hidden="true">
          <span className="treasury-loader-halo" />
          <span className="treasury-loader-orbit" />
          <span className="treasury-loader-coin-path">
            <span className="treasury-loader-coin"><span>₹</span></span>
          </span>
          <span className="treasury-loader-box">
            <span className="treasury-loader-lid" />
            <span className="treasury-loader-lamp" />
          </span>
          <span className="treasury-loader-ripple" />
          <span className="treasury-loader-sparks">
            {sparkAngles.map((angle, index) => (
              <i key={angle} style={{ '--spark-angle': `${angle}deg`, '--spark-travel': `${18 + (index % 3) * 4}cqw` }} />
            ))}
          </span>
        </div>
        <p className="mt-3 text-base font-semibold text-toloba-dark sm:text-lg">{label}</p>
      </div>
    </div>
  );
}
