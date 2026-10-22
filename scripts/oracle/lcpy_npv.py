"""Independent check of V2's money maths, using lcpy (BSD-3, arXiv 2506.13744).

Not part of the app or CI. Run with lcpy's own environment:
    ~/lca/lcpy-master/.venv/bin/python -I scripts/oracle/lcpy_npv.py
Each case: an upfront cost in year 0, then equal annual savings for `years` years,
discounted at `rate`. lcpy takes discount FACTORS (1/(1+r)^t), discounts construction-year
costs by their own year, and gives operating flows one more factor for the construction period,
so this layout reproduces NPV = -C0 + sum_{t=1..N} S/(1+r)^t exactly.
"""
import json, sys
import numpy as np
from lcpy.calculators.econ_calc import FastTeaCalculator


def npv_lcpy(upfront, saving, years, rate):
    d = np.array([1.0 / (1.0 + rate) ** t for t in range(years + 2)], dtype=np.float64)
    calc = FastTeaCalculator(number_of_infrastructure_processes=1, construction_years=1, scenarios=1, discount_rate=rate)
    # operating cost processes first, then the infrastructure (upfront) process last
    calc.cost_calculation({'running cost': [np.zeros((1, years))]}, d, num=-1, infrastructure=False)
    calc.cost_calculation({'upfront': [np.full((1, 1), float(upfront))]}, d, num=-1, infrastructure=True)
    calc.revenue_calculation({'saving': [np.full((1, years), float(saving))]}, d, num=1)
    calc.npv_calculation(d, 'case')
    return float(calc.npv['case'][0])


def npv_hand(upfront, saving, years, rate):
    return -upfront + sum(saving / (1.0 + rate) ** t for t in range(1, years + 1))


CASES = [
    # WV0661 FY2024, recommendation 1 (ITAC verified): $15,969 to implement, saves $4,127 energy + $2,485 demand a year.
    # Life and rate are ASSUMPTIONS for the check, not plant facts.
    {'name': 'WV0661 rec 1', 'upfront': 15969, 'saving': 4127 + 2485, 'years': 10, 'rate': 0.07},
    {'name': 'WV0661 rec 4 (implemented)', 'upfront': 12165, 'saving': 2626, 'years': 10, 'rate': 0.07},
    {'name': 'edge: zero rate', 'upfront': 1000, 'saving': 200, 'years': 5, 'rate': 0.0},
]

if __name__ == '__main__':
    worst = 0.0
    for c in CASES:
        a = npv_lcpy(c['upfront'], c['saving'], c['years'], c['rate'])
        b = npv_hand(c['upfront'], c['saving'], c['years'], c['rate'])
        rel = abs(a - b) / max(1.0, abs(b))
        worst = max(worst, rel)
        print(json.dumps({'case': c['name'], 'lcpy_npv': round(a, 6), 'hand_npv': round(b, 6), 'rel_diff': rel}))
    sys.exit(0 if worst <= 1e-4 else 1)
