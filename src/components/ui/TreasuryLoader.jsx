import './TreasuryLoader.css';

export default function TreasuryLoader({ label = 'Loading treasury data…' }) {
  return (
    <div role="status" className="grid min-h-full place-items-center py-4">
      <div className="grid w-full justify-items-center text-center">
        <div className="treasury-loader-scene" aria-hidden="true">
          <span className="treasury-loader-orbit" />
          <span className="treasury-loader-coin"><span>₹</span></span>
          <span className="treasury-loader-box">
            <span className="treasury-loader-slot" />
            <span className="treasury-loader-lamp" />
          </span>
          <span className="treasury-loader-ripple" />
          <span className="treasury-loader-sparks">
            {[0, 1, 2, 3, 4, 5, 6, 7].map(index => (
              <i key={index} style={{ '--spark-angle': `${index * 45}deg` }} />
            ))}
          </span>
        </div>
        <p className="mt-3 text-base font-semibold text-toloba-dark sm:text-lg">{label}</p>
      </div>
    </div>
  );
}
