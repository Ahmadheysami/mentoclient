<script setup lang="ts">
import VueApexCharts, {type VueApexChartsComponentProps} from "vue3-apexcharts";

const series = [83],
  chartOptions = {
    chart: {
      height: 300,
      type: "gauge",
    },
    plotOptions: {
      radialBar: {
        startAngle: -90,
        endAngle: 90,
        track: {
          background: "#e7e7e7",
          strokeWidth: "97%",
          margin: 5,
        },
        dataLabels: {
          name: { show: false },
          value: {
            offsetY: -2,
            fontSize: "32px",
            formatter: function (val: number) {
              return val + "%";
            },
          },
        },
      },
    },
    fill: {
      type: "gradient",
      gradient: {
        shade: "light",
        shadeIntensity: 0.4,
        inverseColors: false,
        opacityFrom: 1,
        opacityTo: 1,
        stops: [0, 50, 53, 91],
      },
    },
    labels: ["Score"],
  };
</script>

<template>
  <div>
    <div id="chart">
      <vue-apex-charts
        type="gauge"
        height="300"
        :options="(chartOptions as any)"
        :series="series"
      ></vue-apex-charts>
    </div>
  </div>
</template>
