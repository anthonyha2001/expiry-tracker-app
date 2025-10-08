import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

const MultiSelectDropdown = ({ options, selectedOptions, onChange, placeholder = "Select Groups" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleToggle = (option) => {
    const newSelection = selectedOptions.includes(option)
      ? selectedOptions.filter(item => item !== option)
      : [...selectedOptions, option];
    onChange(newSelection);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownRef]);

  return (
    <div className="multi-select-dropdown" ref={dropdownRef}>
      <button className="dropdown-button" onClick={() => setIsOpen(!isOpen)}>
        <span>
          {selectedOptions.length > 0 ? `${selectedOptions.length} Groups Selected` : placeholder}
        </span>
        <ChevronDown size={20} className={`chevron-icon ${isOpen ? 'open' : ''}`} />
      </button>
      {isOpen && (
        <div className="dropdown-panel">
          {options.sort().map(option => (
            <label key={option} className="dropdown-item">
              <input
                type="checkbox"
                className="checkbox-input"
                checked={selectedOptions.includes(option)}
                onChange={() => handleToggle(option)}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

export default MultiSelectDropdown;
