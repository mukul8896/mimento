import base from '@momentpath/config/eslint';

export default [...base, { ignores: ['src/generated/**', 'dist/**'] }];
