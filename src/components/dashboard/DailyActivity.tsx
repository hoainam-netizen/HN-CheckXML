const DailyActivity = () => {

  const ActivitySteps = [
    {
      Time: "",
      action: "KIỂM LỖI MỘT SỐ CHUYÊN ĐỀ BHXH",
      color: "bg-green-500",
      line: "h-full w-px bg-gray-300",
    },
    {
      Time: "",
      action: "ĐỐI CHIẾU HS 01/BH - TT12",
      color: "bg-blue-500",
      line: "h-full w-px bg-gray-300",
    },
    {
      Time: "",
      action: "XUẤT EXCEL THEO MẪU 01/BH - TT12",
      id: "#ML-3467",
      color: "bg-orange-400",
      line: "h-full w-px bg-gray-300",
    },

    {
      Time: "",
      action: "TẠO DANH MỤC ĐẨY CỔNG TT12",
      id: "#ML-3467",
      color: "bg-purple-500",
      line: "h-full w-px bg-gray-300",
    },
    {
      Time: "",
      action: "XUẤT EXCEL TỪ FILE XML 3176",
      id: "#ML-3467",
      color: "bg-pink-500",
      line: "h-full w-px bg-gray-300",
    },
    {
      Time: "",
      action: "ĐỌC FULL 15 BẢNG TỪ FILE XML 3176",
      color: "bg-red-500",
    },
  ];
  return (
    <>
      <div className="rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-darkgray p-6 relative w-full break-words">
        <div className="flex flex-col">
          <ul>
            {ActivitySteps.map((item, index) => {
              return (
                <li key={index}>
                  <div className="flex gap-4 min-h-16">
                    <div className="">
                      <p>{item.Time}</p>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className={`rounded-full ${item.color} p-1.5 w-fit`}></div>
                      <div className={`${item.line}`}></div>
                    </div>
                    <div className="">
                      <p className="text-dark text-start">{item.action}</p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </>
  );
};

export default DailyActivity;
