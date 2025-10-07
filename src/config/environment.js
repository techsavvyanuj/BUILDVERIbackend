/**
 * Environment variable validation and configuration
 */

let hasChecked = false;

const checkEnvironmentVariables = () => {
    if (hasChecked) return;
    
    const criticalVars = {
        'MONGODB_URI': process.env.MONGODB_URI,
        'JWT_SECRET': process.env.JWT_SECRET,
        'NODE_ENV': process.env.NODE_ENV,
        'JWT_EXPIRE': process.env.JWT_EXPIRE
    };
    
    const missingVars = Object.entries(criticalVars)
        .filter(([, value]) => !value)
        .map(([name]) => name);
        
    if (missingVars.length > 0) {
        console.warn('⚠️  Missing critical environment variables:');
        missingVars.forEach(name => console.warn(`   - ${name}`));
        console.warn('⚠️  Check your .env file and restart the server.');
        process.exit(1);
    }
    
    console.log('✅ All critical environment variables are set.');
    hasChecked = true;
};

module.exports = {
    checkEnvironmentVariables
};
