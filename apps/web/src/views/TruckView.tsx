import { fmt } from '@trucksim/core';
import { IconBolt, IconFuel, IconGauge, IconTruck, IconWarn } from '../components/Icons';
import { Bar, Empty, PageHeader, Ring, Stat } from '../components/ui';
import { useNow, useUnits } from '../lib/hooks';
import { freshness, useTelemetry } from '../lib/telemetry';

const WARN: Record<string, string> = {
  fuel: 'Combustibil scăzut', adblue: 'AdBlue scăzut', airPressure: 'Presiune aer scăzută', airPressureEmergency: 'Presiune aer critică',
  oilPressure: 'Presiune ulei', waterTemperature: 'Temperatură apă', batteryVoltage: 'Tensiune baterie',
};
const WEAR: Array<[keyof import('@trucksim/core').Wear, string]> = [
  ['engine', 'Motor'], ['transmission', 'Transmisie'], ['cabin', 'Cabină'], ['chassis', 'Șasiu'], ['wheels', 'Roți'],
];

function wearTone(v: number | null): string {
  if (v === null) return 'var(--fill)';
  return v < 0.1 ? 'var(--green)' : v < 0.3 ? 'var(--yellow)' : 'var(--red)';
}

export function TruckView() {
  const t = useTelemetry();
  const now = useNow(1000);
  const f = freshness(t, now);
  const snap = t.snapshot;
  const units = useUnits(snap?.game.id ?? null);
  const live = snap?.sdkActive && f !== 'stale' && f !== 'offline';

  if (!live || !snap) {
    return (
      <div className="page"><div className="page-inner">
        <PageHeader title="Camion" />
        <Empty icon={<IconTruck />} title="Fără date live">Pornește jocul și bridge-ul. Nu afișăm valori vechi ca fiind live.</Empty>
      </div></div>
    );
  }

  const tr = snap.truck;
  const fuelFrac = tr.fuelL !== null && tr.fuelCapacityL ? tr.fuelL / tr.fuelCapacityL : null;
  const adFrac = tr.adblueL !== null && tr.adblueCapacityL ? tr.adblueL / tr.adblueCapacityL : null;
  const rpmFrac = tr.engineRpm !== null && tr.engineRpmMax ? tr.engineRpm / tr.engineRpmMax : null;
  const warnings = Object.entries(tr.warnings).filter(([, v]) => v).map(([k]) => WARN[k] ?? k);
  const name = [tr.brand, tr.name].filter(Boolean).join(' ') || 'Camion';

  return (
    <div className="page"><div className="page-inner">
      <PageHeader title="Camion" sub={<span className="muted">{name}{tr.licensePlate ? ` · ${tr.licensePlate}` : ''}</span>} />

      {warnings.length ? (
        <div className="callout" style={{ marginBottom: 12 }}>
          <IconWarn />
          <div><b>Avertizări active</b><div className="muted">{warnings.join(' · ')}</div></div>
        </div>
      ) : null}

      <div className="card dash">
        <div className="dash-speed">
          <Ring value={tr.speedKmh !== null ? Math.min(1, tr.speedKmh / 130) : null} size={176} stroke={14} tone="var(--blue)" label="Viteză">
            <div>
              <div className="dash-big num">{tr.speedKmh !== null ? Math.round(fmt.speedValue(tr.speedKmh, units)!) : '—'}</div>
              <div className="muted" style={{ fontSize: 13, fontWeight: 600 }}>{units === 'imperial' ? 'mph' : 'km/h'}</div>
            </div>
          </Ring>
          <div className="dash-side">
            <div className="dash-chip">
              <span className="muted">Treaptă</span>
              <b className="num">{fmt.gearLabel(tr.gear)}</b>
            </div>
            <div className="dash-chip">
              <span className="muted">Cruise</span>
              <b className="num" style={{ color: tr.cruiseControlOn ? 'var(--green)' : 'var(--label-3)' }}>
                {tr.cruiseControlOn ? Math.round(fmt.speedValue(tr.cruiseControlKmh, units) ?? 0) : 'Off'}
              </b>
            </div>
            <div className="dash-chip">
              <span className="muted">Limită</span>
              <b className="num">{snap.navigation.speedLimitKmh ? Math.round(fmt.speedValue(snap.navigation.speedLimitKmh, units)!) : '—'}</b>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <div className="muted" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span>Turație</span><span className="num">{fmt.number(tr.engineRpm)} / {fmt.number(tr.engineRpmMax)} rpm</span>
          </div>
          <Bar value={rpmFrac} tone={rpmFrac !== null && rpmFrac > 0.85 ? 'var(--red)' : 'var(--teal)'} />
        </div>
        <div className="lights" aria-label="Lumini și stare">
          <Light on={tr.engineOn} label="Motor" tone="var(--green)" />
          <Light on={tr.parkingBrake} label="Frână parcare" tone="var(--red)" />
          <Light on={tr.engineBrake} label="Frână motor" tone="var(--orange)" />
          <Light on={tr.lights.lowBeam} label="Faza scurtă" tone="var(--green)" />
          <Light on={tr.lights.highBeam} label="Faza lungă" tone="var(--blue)" />
          <Light on={tr.lights.beacon} label="Girofar" tone="var(--orange)" />
          <Light on={tr.lights.hazard} label="Avarii" tone="var(--orange)" />
        </div>
      </div>

      <div className="grid grid-2 stack-sm" style={{ marginTop: 12 }}>
        <div className="stat" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <Ring value={fuelFrac} size={78} stroke={9} tone={fuelFrac !== null && fuelFrac < 0.15 ? 'var(--red)' : 'var(--green)'} label="Combustibil">
            <span className="num" style={{ fontWeight: 700, fontSize: 15 }}>{fmt.percent(fuelFrac)}</span>
          </Ring>
          <div style={{ minWidth: 0 }}>
            <div className="stat-label"><IconFuel />Combustibil</div>
            <div className="stat-value" style={{ fontSize: 22 }}>{fmt.volume(tr.fuelL, units)}</div>
            <div className="stat-foot">autonomie {fmt.distance(tr.fuelRangeKm, units)}</div>
          </div>
        </div>
        <div className="stat" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <Ring value={adFrac} size={78} stroke={9} tone="var(--teal)" label="AdBlue">
            <span className="num" style={{ fontWeight: 700, fontSize: 15 }}>{fmt.percent(adFrac)}</span>
          </Ring>
          <div style={{ minWidth: 0 }}>
            <div className="stat-label">AdBlue</div>
            <div className="stat-value" style={{ fontSize: 22 }}>{fmt.volume(tr.adblueL, units)}</div>
            <div className="stat-foot">din {fmt.volume(tr.adblueCapacityL, units)}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginTop: 12 }}>
        <Stat label="Consum mediu" value={tr.fuelAvgLPerKm !== null ? (units === 'imperial' ? fmt.number(1 / (tr.fuelAvgLPerKm * fmt.L_PER_GAL / fmt.KM_PER_MILE), 1) : fmt.number(tr.fuelAvgLPerKm * 100, 1)) : '—'} unit={units === 'imperial' ? 'mpg' : 'L/100'} />
        <Stat label="Odometru" value={fmt.number(tr.odometerKm !== null ? (units === 'imperial' ? tr.odometerKm / fmt.KM_PER_MILE : tr.odometerKm) : null)} unit={units === 'imperial' ? 'mi' : 'km'} />
        <Stat label="Apă / ulei" value={`${fmt.number(tr.waterTempC)}° / ${fmt.number(tr.oilTempC)}°`} />
        <Stat icon={<IconBolt />} label="Baterie" value={fmt.number(tr.batteryVoltage, 1)} unit="V" foot={`aer ${fmt.number(tr.airPressurePsi)} psi`} />
      </div>

      <h2 className="section-title">Uzură</h2>
      <div className="list">
        {WEAR.map(([k, label]) => (
          <div className="row" key={k}>
            <div className="grow">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span>{label}</span><span className="value">{fmt.percent(tr.wear[k], 1)}</span>
              </div>
              <Bar value={tr.wear[k]} tone={wearTone(tr.wear[k])} />
            </div>
          </div>
        ))}
        {snap.trailers.filter((x) => x.attached).map((x, i) => (
          <div className="row" key={`t${i}`}>
            <div className="grow">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="truncate">Remorcă{x.name ? ` · ${x.name}` : ''}</span>
                <span className="value">{fmt.percent(x.wear.chassis, 1)}</span>
              </div>
              <Bar value={x.wear.chassis} tone={wearTone(x.wear.chassis)} />
            </div>
          </div>
        ))}
      </div>
      <p className="note">
        <IconGauge style={{ width: 14, height: 14, verticalAlign: -2 }} /> Valorile vin direct din telemetria jocului (plugin scs-sdk, revizia {snap.game.pluginRevision ?? '?'}). Câmpurile indisponibile apar ca „—”.
      </p>
    </div></div>
  );
}

function Light({ on, label, tone }: { on: boolean; label: string; tone: string }) {
  return (
    <span className="light" style={on ? { background: `color-mix(in srgb, ${tone} 20%, transparent)`, color: tone } : undefined}>
      <i style={{ background: on ? tone : 'var(--label-3)' }} />
      {label}
    </span>
  );
}
