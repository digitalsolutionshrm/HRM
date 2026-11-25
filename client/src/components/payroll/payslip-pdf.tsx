import React from 'react';
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';

export interface PayslipData {
  companyName: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  designation?: string;
  month: string;
  year: number;
  basicSalary: number;
  hra: number;
  bonus: number;
  allowances: number;
  overtime: number;
  overtimeHours: number;
  grossSalary: number;
  pf: number;
  esi: number;
  tax: number;
  attendanceDeductions: number;
  leaveDeductions: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
  attendanceDays: number;
  absentDays: number;
  halfDays: number;
  leaveDays: number;
}

const styles = StyleSheet.create({
  page: { padding: 30, backgroundColor: '#ffffff', fontFamily: 'Helvetica', fontSize: 10 },
  header: { textAlign: 'center', marginBottom: 24 },
  companyName: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  title: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 8 },
  info: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  column: { width: '48%' },
  row: { flexDirection: 'row', marginBottom: 4 },
  label: { width: '42%', color: '#666666' },
  value: { width: '58%', fontFamily: 'Helvetica-Bold' },
  table: { width: '100%', borderWidth: 1, borderColor: '#000000', marginTop: 8 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000000' },
  tableHeader: { backgroundColor: '#f0f0f0', fontFamily: 'Helvetica-Bold' },
  cell: { flex: 1, padding: 7 },
  right: { textAlign: 'right' },
  bold: { fontFamily: 'Helvetica-Bold' },
  signature: { marginTop: 40, textAlign: 'right' },
  note: { marginTop: 24, fontSize: 8, color: '#888888', textAlign: 'center' },
});

// The built-in PDF fonts do not contain the rupee glyph, so "Rs." is used.
const money = (amount: number) =>
  `Rs. ${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function PayslipDocument({ data }: { data: PayslipData }) {
  const earnings: [string, number][] = [
    ['Basic', data.basicSalary],
    ['HRA', data.hra],
    ['Bonus', data.bonus],
    ['Other Allowances', data.allowances],
  ];
  if (data.overtime > 0) earnings.push([`Overtime (${data.overtimeHours}h)`, data.overtime]);

  const deductions: [string, number][] = [
    ['PF', data.pf],
    ['ESI', data.esi],
    ['Tax', data.tax],
    ['Attendance Deductions', data.attendanceDeductions],
    ['Leave Deductions', data.leaveDeductions],
  ];
  if (data.otherDeductions > 0) deductions.push(['Other Deductions', data.otherDeductions]);

  const rows = Math.max(earnings.length, deductions.length);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.companyName}>{data.companyName}</Text>
          <Text style={styles.title}>Payslip for the month of {data.month} {data.year}</Text>
        </View>

        <View style={styles.info}>
          <View style={styles.column}>
            <View style={styles.row}><Text style={styles.label}>Emp ID:</Text><Text style={styles.value}>{data.employeeCode}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Employee Name:</Text><Text style={styles.value}>{data.employeeName}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Department:</Text><Text style={styles.value}>{data.department}</Text></View>
            {data.designation ? <View style={styles.row}><Text style={styles.label}>Designation:</Text><Text style={styles.value}>{data.designation}</Text></View> : null}
          </View>
          <View style={styles.column}>
            <View style={styles.row}><Text style={styles.label}>Month:</Text><Text style={styles.value}>{data.month} {data.year}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Attendance Days:</Text><Text style={styles.value}>{data.attendanceDays}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Absent / Half Days:</Text><Text style={styles.value}>{data.absentDays} / {data.halfDays}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Leave Days:</Text><Text style={styles.value}>{data.leaveDays}</Text></View>
          </View>
        </View>

        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.cell}>Earnings</Text>
            <Text style={[styles.cell, styles.right]}>Amount</Text>
            <Text style={styles.cell}>Deductions</Text>
            <Text style={[styles.cell, styles.right]}>Amount</Text>
          </View>

          {Array.from({ length: rows }).map((_, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.cell}>{earnings[index]?.[0] ?? ''}</Text>
              <Text style={[styles.cell, styles.right]}>{earnings[index] ? money(earnings[index][1]) : ''}</Text>
              <Text style={styles.cell}>{deductions[index]?.[0] ?? ''}</Text>
              <Text style={[styles.cell, styles.right]}>{deductions[index] ? money(deductions[index][1]) : ''}</Text>
            </View>
          ))}

          <View style={[styles.tableRow, styles.bold]}>
            <Text style={styles.cell}>Total Earnings</Text>
            <Text style={[styles.cell, styles.right]}>{money(data.grossSalary)}</Text>
            <Text style={styles.cell}>Total Deductions</Text>
            <Text style={[styles.cell, styles.right]}>{money(data.totalDeductions)}</Text>
          </View>

          <View style={[styles.tableRow, styles.bold, { borderBottomWidth: 0, fontSize: 12 }]}>
            <Text style={styles.cell}>Net Pay</Text>
            <Text style={[styles.cell, styles.right]}>{money(data.netSalary)}</Text>
            <Text style={styles.cell}></Text>
            <Text style={styles.cell}></Text>
          </View>
        </View>

        <View style={styles.signature}>
          <Text style={{ borderTopWidth: 1, borderTopColor: '#000000', paddingTop: 5 }}>Authorised Signature</Text>
          <Text style={{ marginTop: 8 }}>{data.companyName}</Text>
        </View>

        <Text style={styles.note}>Monthly gross is split into Basic (40%), HRA (16%) and Allowances (44%). Deductions are shown separately. This is a system generated payslip.</Text>
      </Page>
    </Document>
  );
}

export async function generatePayslipPdf(data: PayslipData): Promise<Blob> {
  return pdf(<PayslipDocument data={data} />).toBlob();
}
