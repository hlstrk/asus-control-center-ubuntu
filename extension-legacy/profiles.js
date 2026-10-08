// SPDX-License-Identifier: MPL-2.0
var PROFILES = [
    {label: 'Performance', cli: 'Performance', kernel: 'performance', icon: 'power-profile-performance-symbolic', hint: 'Maximum performance'},
    {label: 'Balanced', cli: 'Balanced', kernel: 'balanced', icon: 'power-profile-balanced-symbolic', hint: 'Performance and efficiency'},
    {label: 'Battery Saver', cli: 'Quiet', kernel: 'quiet', icon: 'power-profile-power-saver-symbolic', hint: 'Lower power and fan noise'},
];

function profileIndex(value) {
    const key = String(value ?? '').trim().toLowerCase();
    return PROFILES.findIndex(p => p.kernel === key || p.cli.toLowerCase() === key || (key === 'low-power' && p.cli === 'Quiet'));
}

function reducePower(previous, observed) {
    if (observed === null)
        return {...previous, candidate: null, samples: 0, changed: false};
    if (previous.stable === null)
        return {stable: observed, candidate: observed, samples: 0, changed: false};
    if (observed === previous.stable)
        return {...previous, candidate: observed, samples: 0, changed: false};
    const samples = observed === previous.candidate ? previous.samples + 1 : 1;
    return samples >= 2
        ? {stable: observed, candidate: observed, samples: 0, changed: true}
        : {...previous, candidate: observed, samples, changed: false};
}
