import React, { useMemo } from 'react';
import { useInventory } from '../hooks/useInventory.js';

const PricingReportPage = () => {
    const { pricingRules, loading } = useInventory();

    // Group rules by supplier for a structured view
    const rulesBySupplier = useMemo(() => {
        const grouped = {};
        pricingRules.forEach(rule => {
            const supplier = rule.supplier || 'Any Supplier';
            if (!grouped[supplier]) {
                grouped[supplier] = [];
            }
            grouped[supplier].push(rule);
        });
        return grouped;
    }, [pricingRules]);

    if (loading) {
        return <p>Loading report...</p>;
    }

    return (
        <div className="page-container">
            <h1 className="page-title">Pricing Rules Report</h1>
            <p className="page-subtitle">A summary of all automated pricing rules currently saved in the system.</p>

            {Object.keys(rulesBySupplier).sort().map(supplier => (
                <div key={supplier} className="settings-section">
                    <h2 className="container-title">{supplier}</h2>
                    <div className="table-container">
                        <table className="records-table">
                            <thead>
                                <tr>
                                    <th>Category</th>
                                    <th>Sub-Category</th>
                                    <th>Brand</th>
                                    <th>Percentage</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rulesBySupplier[supplier].map(rule => (
                                    <tr key={rule.id}>
                                        <td>{rule.category || '-'}</td>
                                        <td>{rule.subCategory || '-'}</td>
                                        <td>{rule.brand || '-'}</td>
                                        <td>{rule.percentage}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default PricingReportPage;
