import React, { useState } from "react";

function Receipt() {
  const [formData, setFormData] = useState({
    date: "",
    name: "",
    tin: "",
    businessStyle: "",
    address: "",
    fixedDeposit: "",
    regularLoan: "",
    emergencyLoan: "",
    interest: "",
    serviceFee: "",
    mortuary: "",
    membershipFee: "",
    sap: "",
    lrf: "",
    others: "",
  });

  const [total, setTotal] = useState(0);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updatedFormData = { ...formData, [name]: value };
    setFormData(updatedFormData);

    const fields = [
      "fixedDeposit",
      "regularLoan",
      "emergencyLoan",
      "interest",
      "serviceFee",
      "mortuary",
      "membershipFee",
      "sap",
      "lrf",
      "others",
    ];

    const updatedTotal = fields.reduce((acc, key) => {
      return acc + (parseFloat(updatedFormData[key]) || 0);
    }, 0);

    setTotal(updatedTotal);
  };

  return (
    <div
      style={{
        width: "600px",
        margin: "20px auto",
        padding: "20px",
        border: "1px solid black",
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        lineHeight: "1.5",
      }}
    >
      <h2 style={{ textAlign: "center", marginBottom: "10px", fontWeight: "bold" }}>
        MOUNTAIN PROVINCE STATE POLYTECHNIC COLLEGE
      </h2>
      <h3 style={{ textAlign: "center", marginBottom: "10px", fontWeight: "bold" }}>
        EMPLOYEES CREDIT COOPERATIVE (MPSPCECCO)
      </h3>
      <p style={{ textAlign: "center", margin: "0" }}>Non-VAT Reg. TIN: 632-914-794-000</p>
      <p style={{ textAlign: "center", margin: "0" }}>Caluttit, Bontoc, Mt. Province</p>

      <h3 style={{ textAlign: "center", marginBottom: "20px" }}>OFFICIAL RECEIPT</h3>

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: "10px" }}>
        <span style={{ marginRight: "10px" }}>DATE:</span>
        <input
          type="text"
          name="date"
          value={formData.date}
          onChange={handleChange}
          style={{
            width: "150px",
            border: "none",
            borderBottom: "1px solid black",
            textAlign: "right",
            backgroundColor: "transparent",
            fontFamily: "inherit",
            fontSize: "inherit",
          }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <span style={{ flex: 1 }}>Received from:</span>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          style={{
            border: "none",
            borderBottom: "1px solid black",
            textAlign: "right",
            width: "490px",
          }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <span style={{ flex: 1 }}>TIN:</span>
        <input
          type="text"
          name="tin"
          value={formData.tin}
          onChange={handleChange}
          style={{
            border: "none",
            borderBottom: "1px solid black",
            textAlign: "left",
            width: "200px",
          }}
        />
        <span style={{ flex: 1, textAlign: "right" }}>Business Style:</span>
        <input
          type="text"
          name="businessStyle"
          value={formData.businessStyle}
          onChange={handleChange}
          style={{
            flex: 1,
            border: "none",
            borderBottom: "1px solid black",
            textAlign: "left",
            paddingLeft: "5px",
            backgroundColor: "transparent",
            fontFamily: "inherit",
            fontSize: "inherit",
          }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
        <span>Address:</span>
        <input
          type="text"
          name="address"
          value={formData.address}
          onChange={handleChange}
          style={{
            border: "none",
            borderBottom: "1px solid black",
            textAlign: "right",
            width: "530px",
          }}
        />
      </div>

      <div style={{ marginBottom: "10px", display: "flex", alignItems: "center" }}>
        <span>The sum of</span>
        <input
          type="text"
          name="sumWords"
          value={formData.sumWords}
          onChange={handleChange}
          style={{
            flex: 1,
            marginLeft: "10px",
            border: "none",
            borderBottom: "1px solid black",
            textAlign: "left",
            paddingLeft: "5px",
            backgroundColor: "transparent",
            fontFamily: "inherit",
            fontSize: "inherit",
          }}
        />
      </div>

      <div style={{ marginBottom: "10px", display: "flex", alignItems: "center" }}>
      <span>(₱</span>
        <input
          type="text"
          name="amount"
          value={formData.amount}
          onChange={handleChange}
          style={{
            width: "150px",
            margin: "0 5px",
            border: "none",
            borderBottom: "1px solid black",
            textAlign: "center",
            backgroundColor: "transparent",
            fontFamily: "inherit",
            fontSize: "inherit",
          }}
        />
        <span>) in [ ] part [ ] payment of:</span>
      </div>

      {[
        "Fixed Deposit",
        "Regular Loan",
        "Emergency Loan",
        "Interest",
        "Service Fee",
        "Mortuary",
        "Membership Fee",
        "SAP",
        "LRF",
        "Others",
      ].map((label, index) => {
        const key = label.toLowerCase().replace(/\s+/g, "");
        return (
          <div key={index} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
            <span>{label}:</span>
            <input
              type="text"
              name={key}
              value={formData[key] || ""}
              onChange={handleChange}
              style={{
                border: "none",
                borderBottom: "1px solid black",
                textAlign: "right",
                width: "300px",
              }}
            />
          </div>
        );
      })}

      <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "20px" }}>Total: ₱___________________</div>

      <div style={{ marginTop: "40px", textAlign: "center", fontWeight: "bold" }}>
        <p>______________________________</p>
        <p>Signature</p>
      </div>
    </div>
  );
}

export default Receipt;
