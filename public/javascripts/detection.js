;(function(window, undefined){
	window.detection = window.detection || {};

	tracking.ObjectTracker.prototype.track = function(pixels, width, height) {
        var self = this;
        var classifiers = this.getClassifiers();

        if (!classifiers) {
          throw new Error('Object classifier not specified, try `new tracking.ObjectTracker("face")`.');
        }

        var results = [];
        var tmpRes;

        var i = 1;
        var typeOfArea;
        classifiers.forEach(function(classifier) {
              if(classifier[3]==6)
                typeOfArea = "eye";
              else if(classifier[3]==13)
                typeOfArea = "mouth";
              else if(classifier[3]==3)
                typeOfArea = "face";
              tmpRes = tracking.ViolaJones.detect(pixels, width, height, self.getInitialScale(), self.getScaleFactor(), self.getStepSize(), self.getEdgesDensity(), classifier);
              tmpRes.forEach(function(tmpResData){
                tmpResData.typeOfArea = typeOfArea;
              });
              results = results.concat(tmpRes);
        });

        this.emit('track', {
          data: results
        });
  };



	    // минимальный процент пересечения двух rects
	var SQUARES_INTERSECTION_MIN_PERCENT = 30,
        PERSON_TIMEOUT = 1,
        SUSPECT_OBJ_MIN_LIFE_TIME_TO_EVOLVE = 200,
        SUSPECT_OBJ_MAX_LIFE_TIME_TO_DELETE = 100;
	detection.doNotRepeatAlert = false;
    detection.init = function(element){
        detection.updateFrequency = 0;
        detection.numOfUpdates = 0;
        detection.startTime = Date.now();
        detection.frame = [];
        detection.frame.width = element.offsetWidth;
        detection.frame.height = element.offsetHeight;
    };
	    // Конструктор todo: реализовать lifeTime
	var Person = function(){
        this._timeCreated = Date.now();
        this._lifeTime= 0; // ms
        this._eyes = [];
        this._face;
        this._mouths = [];
        this._allAreas = [];
        this._lastActiveTime = Date.now();
        this._nearEdge = false;
        this._width = 0;
        this._height = 0;
        this._x = 0;
        this._y = 0;
        this._checkEdge = function(){
            var minDistToHorizEdge = (detection.frame.width - this._width)/8,
                minDistToVertEdge = (detection.frame.height - this._height)/8,
                res = false;
            if(this._x <= minDistToHorizEdge)
                res = true;
            else if(this._x > detection.frame.width - minDistToHorizEdge)
                res = true;
            else if(this._y <= minDistToVertEdge)
                res = true;
            else if(this._y > detection.frame.height - minDistToVertEdge)
                res = true;
            this._nearEdge = res;
            return res;
        };
    };
    Person.prototype.getAllAreas = function () {
        return this._allAreas;
    }
	Person.prototype.updateAllAreas = function(){
	    this._allAreas = [];
	    this._eyes.forEach(function(eye){this._allAreas.push(eye);});
	    if(this._face){
            this._allAreas.push(this._face);
            // todo: изменить на вычисление!!!
            this._width = this._face.width;
            this._height = this._face.height;
            this._x = this._face.x;
            this._y = this._face.y;
        }
        this._mouths.forEach(function(mouth){this._allAreas.push(mouth);});
        this._checkEdge();
    }
    Person.prototype.updateLastActiveTime = function(){
	    this._lastActiveTime = Date.now();
    }
    Person.prototype.getLastActiveTime = function(){return this._lastActiveTime;};
    Person.prototype.getTimeout = function(){return Date.now()-this._lastActiveTime;}
    Person.prototype.comparison = function(rect){
	    if(!this._allAreas.length)
	        return -1;
	    var res = findIntersections(this._allAreas.concat(rect), 60, 100);
        deleteArea(res, rect);
        if(res.length>0)
            return equivalentRectIndex(this._allAreas, res[0]);
        // по-хорошему, необходимо еще реализовать возможность, если у нас несколько
        // таких пересечений. Хотя это возможно, только если пересечения
        // относятся к частям лица, так что ничего страшного. Лишние
        // области хранится не должны
    }
    Person.prototype.updateArea = function(area){
        var simAreaIndex = this.comparison(area);
        if(simAreaIndex==-1){
            var clone = makeClone(area);
            clone.timeStampCreate = Date.now();
            if(area.typeOfArea == "eye")
                this._eyes.push(makeClone(clone));
            else if(area.typeOfArea == "mouth")
                this._mouths.push(makeClone(clone));
            else if(area.typeOfArea == "face")
                this._face = makeClone(clone);
            this.updateAllAreas();
            return 2;
        }
        var clone = makeClone(area);
        clone.timeStampCreate = Date.now();
        this._allAreas[simAreaIndex] = clone;
        this.updateAllAreas();
        return 1;
    }
    Person.prototype.updateLifeTime = function(){
        //console.log(this.getTimeout());
        this.lifeTime = Date.now() - this.timeCreated;
			console.log("detection.updateFrequency", detection.updateFrequency);
    }
    Person.prototype.getWidth = function(){return this._width};
    Person.prototype.getHeight = function(){return this._height};
    Person.prototype.getX = function(){return this._x;};
    Person.prototype.getY = function(){return this._y;};
    Person.prototype.getNearEdge = function(){return this._nearEdge;};
    Person.prototype.outOfFrame = function(){
        //console.log(this.getTimeout());
        if(this.getTimeout() > PERSON_TIMEOUT*detection.updateFrequency && !this._nearEdge)
            return true;
        else if(this.getTimeout() > PERSON_TIMEOUT*detection.updateFrequency && this._nearEdge)
            return true;
        return false;
    };
        // todo: добавить использование данного метода в методах, которые перемещают области

    var SuspectObj = function(){};
        // наследование !!!
    SuspectObj.prototype = Object.create(Person.prototype);
    SuspectObj.prototype.checkLifeTime = function(){
        if(this._lifeTime >= SUSPECT_OBJ_MIN_LIFE_TIME_TO_EVOLVE)
            return true;
        else
            return false;
        // todo: реализовать
        // если данный объект живет уже достаочное время, то

    };
        // array of detected persons
	detection.persons = [];
	    // массив с подозрительными элементами
	detection.suspectObjs = [];
    /**
     * PUBLIC function
     * публичный метод, который выполняет поиск лиц на кадре (frame)
     * @param rects
     */
	detection.findFace = function(rects) {
	    var res = [];
	        // разбиваем распознанные элементы согласно типам (typeOfArea)
		var eyes = rects.filter(function(rect){
			return rect.typeOfArea == "eye";
		});
		var faces = rects.filter(function(rect){
			return rect.typeOfArea == "face";
		});
		var mouths = rects.filter(function(rect){
			return rect.typeOfArea == "mouth";
		});

		if(faces.length) {
			//console.log("calling faceViaFaces()");
            var n = faces.length;
            // проходимся по всем найденным face
            for(var i =0; i<n; i++)
                res.push(faceViaFaces());
        }
		else if(eyes.length) {
            //console.log("calling faceViaEyes()");
            faceViaEyes();
        }
		else if(mouths.length) {
            //console.log("calling faceViaEyes()");
            faceViaMouths();
        }
        res.push(controller());
        return res;
        /**
         * функция для определения лица при условии,
         * что есть хотя бы один найденный face.
         * Если их несколько, то обязательно проверяется
         * их пересечение, но если есть пересечение 10%,
         * то ничего страшного. Тогда после определения person,
         * todo: удаляем области, которые ему пренадлежат и опять
         * запускаем faceViaFaces
         */
        function faceViaFaces(){
                // faces, eyes & mouths из [[scope]]
            var currentFaceArea = findAreaAndDelete(faces, "face");
                // находим все элементы внутри области face
            var areas = findIntersections(eyes.concat(mouths), 60, 100, currentFaceArea);
            faces = updateRects(faces, areas);
            areas = deleteAllRectsWithType(areas, "face");
                // объединяем потому, что бибилиотека
                // достаточно часто определяет глаз как mouth
                // вызываем функцию нахлждения пересечений, определенной
                // площадью пересечения
            var intersections = findIntersections(areas,
                SQUARES_INTERSECTION_MIN_PERCENT, 100);
            // todo: вот почему алгоритм не работает, когда в области face у нас нет пересечений, что не работает!!!
            if(intersections.length){
                //console.log("intersections: ", intersections); // количесвто пересекаемых областей
                    // обновляем оригинальные массивы с областями, так как в них может быть
                    // добавлен параметр: есть пересечение, что играет важную роль для дальнейших вычислений
                eyes = updateRects(eyes, intersections);
                mouths = updateRects(mouths, intersections);
            }
            var res = faceVerificationOnFaceArea(eyes.concat(mouths), currentFaceArea);
            eyes = updateRects(eyes, res.rects);
            mouths = updateRects(mouths, res.rects);
            areas = updateRects(areas, res.rects);
                // вызов функции сопоставления найденных объектов
            return comparison(areas.concat(currentFaceArea), res.faceVerify);
            //console.log("comparison:"+comparison(areas.concat(currentFaceArea), res.faceVerify));
        }
        /**
         * функция для определения лица при условии,
         * что есть области с типом "eye" и (или без) "mouth"
         */
        function faceViaEyes(){
            var res = [], suspectedFaceArea = [];
            res.faceVerify = false;
            var areasWithIntersection = findIntersections(eyes.concat(mouths), 60, 100);
            //console.log(areasWithIntersection);
            if(areasWithIntersection.length>2){
                // необходима проверка, есть ли с левой или с правой части такой же объект
                // вычисляем относительно размера найденной области с пересечением!

                suspectedFaceArea.width = areasWithIntersection[0].width * 2.5;
                suspectedFaceArea.height = areasWithIntersection[0].height * 3.5;
                suspectedFaceArea.x = areasWithIntersection[0].x - areasWithIntersection[0].width*1.4; // найденное пересечение является правым глазом
                suspectedFaceArea.y = areasWithIntersection[0].y - areasWithIntersection[0].y*0.3;
                var intersect = findIntersections(eyes.concat(mouths), 70, 100, suspectedFaceArea);
                if(intersect.length > 0){
                    if(intersect.length == 1){
                        if(intersect[0].x < areasWithIntersection[0].x && intersectionOy(intersect[0], areasWithIntersection[0])>40)
                        {
                            intersect[0].facePart = "leftEye";
                            areasWithIntersection[0].facePart = "rightEye";
                            updateRects(eyes, areasWithIntersection);
                            updateRects(mouths, areasWithIntersection);
                            updateRects(eyes, intersect);
                            updateRects(mouths, intersect);
                            console.log("comparison:"+comparison(areas.concat(suspectedFaceArea), res.faceVerify));
														//comparison(suspectedFaceArea, res.faceVerify);
                        }
                    }
                    else {
                        var partOfFace = makeClone(suspectedFaceArea);
                        partOfFace.width = suspectedFaceArea.width /2; // левая часть лица
                        var intersectionsOnFacePart = findIntersections(intersect, 60, 100, partOfFace);
                        if(intersectionsOnFacePart.length == 1){
                            if(intersectionOy(intersect[0], intersectionsOnFacePart[0])>40)
                            {
                                intersect[0].facePart = "leftEye";
                                intersectionsOnFacePart[0].facePart = "rightEye";
                                updateRects(eyes, intersectionsOnFacePart);
                                updateRects(mouths, intersectionsOnFacePart);
                                updateRects(eyes, intersect);
                                updateRects(mouths, intersect);
                                console.log("comparison:"+comparison(areas.concat(suspectedFaceArea), res.faceVerify));
																//comparison(suspectedFaceArea, res.faceVerify);
                            }
                        }
                    }
                }
                // если в массиве mouths есть элементы, и найден intersections, то проверять
                // mouth по разработанному алгоритму в рамках определенной области
            }
            else if(areasWithIntersection.length == 2){
                if(findMouth()) {
                    res.faceVerify = true;
                    console.log("comparison:" + comparison(areas.concat(suspectedFaceArea), res.faceVerify));
										//comparison(areas.concat(suspectedFaceArea), res.faceVerify);
                }

            }


            function findMouth(){
                return false;
            }
        }
        function faceViaMouths(){}
	};
    /**
     * todo: CURRENT WORK
     * Метод сравнения: вычисление принадлежности новых
     * областей (скорей всего элементов suspectObjs и неопознанных областей)
     * относительно существующих областей в persons
     * @param rects
     */
    var comparison = function(rects, faceVerify) {
        var result = "";
				detection.numOfUpdates++;
        if(detection.numOfUpdates < 10)
            detection.updateFrequency = (Date.now() - detection.startTime)/detection.numOfUpdates;
        if(!detection.persons.length){
            if(faceVerify){
                detection.persons.push(new Person());
                detection.persons[0].updateArea(rects);
                result = "NEW";
            }
            else{

            }
        }
        else {
            detection.persons.forEach(function cycle(person) {
                if (cycle.stop) return;
                // находим пересекающиеся области
                var intersects = findIntersections(rects.concat(person.getAllAreas()), 80, 100);
                // найденные пересечения сопоставляем и обновляем в персоне
                // необходим маркер обновления
                // желательно timestamp
                // c его в
                if (!intersects.length)
                    return;
                intersects = deleteAllIntersectedAreas(intersects);
                intersects.forEach(function (intersect) {
                    person.updateArea(intersect);
                });
                result = "FOUND";
                person.updateLastActiveTime();
            });
            if(result === ""){
                if(faceVerify){
                    detection.persons.push(new Person());
                    detection.persons[0].updateArea(rects);
                    result = "NEW";
                }
            }
        }

        var controllerResult = controller();
        if(controllerResult != "")
            result = controllerResult;
        return result;
    };

    /**
     * метод нахождения пересечений.
     * @param {Array} rects -- массив областей
     * @param {int} MIN_INTERSECTION_SQ_PERCENT -- минимальное процентное
     *  соотношение площади пересекаемой области к площади области
     * @param {int} MAX_INTERSECTION_SQ_PERCENT
     * @param {object} searchArea -- определенная область, с которой
     *  необходимо найти пересекающиеся области из rects
     * @returns {Array}
     */
	var findIntersections = function(rects, MIN_INTERSECTION_SQ_PERCENT,
                                     MAX_INTERSECTION_SQ_PERCENT, searchArea){
		var xProjectionsArray = [],
			yProjectionsArray = [],
			intersections = [],
			result = [],
			i = 0;
        if(searchArea){
            xProjectionsArray[i] = searchArea.x;
            yProjectionsArray[i++] = searchArea.y;
            xProjectionsArray[i] = searchArea.x + searchArea.width;
            yProjectionsArray[i++] = searchArea.y + searchArea.height;
        }
            // array|x0|x1|x2|y3|...|xN-2|xN-1| четные ЧИСЛА характеризуют (аналогично для координат по Oy)
            // меньшую координату границы прямоугольника (ОБЛАСТИ, rect) на оси
            // на данной особенности завязаны все манипуляции. Поэтому удобно передавать
            // или работать именно с координатой с нечетным индексом (i), это означает,
            // что мы обращаемся к области с индексом i/2 in rects
            // для замены координат с четным индексом есть функция onlyFirstValue() (см. ниже)
            // так же после (или до, в зависимости от задачи) этого желательно
            // проверить на повторяющиеся индексы. для удаления исп. функцию uniqueAreaIndex() (см. ниже)
		rects.forEach(function(rect){
		    if(rect==undefined || rect==null)
		        return;
			xProjectionsArray[i] = rect.x;
			yProjectionsArray[i++] = rect.y;
			xProjectionsArray[i] = rect.x + rect.width;
			yProjectionsArray[i++] = rect.y + rect.height;
		});
        var n = xProjectionsArray.length;
        if(searchArea)
            {n = 1;}
            // в данном цикле переменная i характеризует область,
            // относительной которой проверяются остальные
            // области на факт существования общей площади (пересечения)
		for(var i=0; i<n; i=i+2)
		{
				// точки пересечения. Хранится индекс точки,
				// чтобы было удобно потом сравнивать по Oy!
			var xIntersections = [];
			for(var j=0; j<xProjectionsArray.length; j++)
				if(j!=i && j!=i+1)
						// проверка на принадлежность отрезку [i, i+1]
					if(xProjectionsArray[j]>=xProjectionsArray[i] &&
                        xProjectionsArray[j]<=xProjectionsArray[i+1])
							// добавление точки, которая принадлежит отрезку в
							// соответсвующий массив
						xIntersections.push(j);
				// проходимся по всем элементам, которые имеют пересечение по
				// Ox, для проверки, не пересекаются ли они по Oy
				// Если условия выполняются, то номер точки заночится в массив пересечений.
            intersections = [];
			for(var j=0; j<xIntersections.length; j++)
				if(yProjectionsArray[xIntersections[j]]>= yProjectionsArray[i] &&
                    yProjectionsArray[xIntersections[j]]<=yProjectionsArray[i+1])
					intersections.push(xIntersections[j]);
				// проверка на повторяющиеся элементы
				// тк в массив были добавлены точки, которые относятся к Oy.
				// Но если есть хотя бы одна точка в массиве, то rects пересекаются!

            intersections = unique(intersections);
			intersections = uniqueAreaIndex(intersections);
			intersections = onlyFirstValue(intersections);
			    // количесвто пересечений относительно объекта i
			var numOfIntersections = 0;
                // вычисляем общую площадь найденных элементов,
				// которые пересекаются с текущим (i) и проверяем с
				// минимально допустимой площадью
			intersections.forEach(function cycle(point){
			    if(cycle.stop) {return;}
				if(percentOfIntersectionSq(
				    intersectionSquare(point, i, xProjectionsArray, yProjectionsArray),
                        point, i, xProjectionsArray, yProjectionsArray) >= MIN_INTERSECTION_SQ_PERCENT){
					numOfIntersections++;
				    var res = rectEquivalent(rects, xProjectionsArray[point], yProjectionsArray[point],
                        xProjectionsArray[point+1]-xProjectionsArray[point],
                        yProjectionsArray[point+1]-yProjectionsArray[point]);
					if(!searchArea)
					    res.intersectionWith = i/2; // индекс элемента, с которым есть пересечение/
				    result.push(res);
                    //cycle.stop = true;
				}
			});
                // в конце цикла i добавляем в результирующий массив саму область i,
                // в которой сохраняем количество пересечений
			if(numOfIntersections && !searchArea){

                    // var res = rectEquivalent([searchArea], xProjectionsArray[i], yProjectionsArray[i],
                    //     xProjectionsArray[i+1]-xProjectionsArray[i],
                    //     yProjectionsArray[i+1]-yProjectionsArray[i]);

                    var res = rectEquivalent(rects, xProjectionsArray[i], yProjectionsArray[i],
                        xProjectionsArray[i+1]-xProjectionsArray[i],
                        yProjectionsArray[i+1]-yProjectionsArray[i]);
                res.numOfIntersections = numOfIntersections;
			    result.push(res);
            }
		}

            // в результирующем массиве пересекающиеся rects
        return result;
	};
    /**
     * функция нахождения глаз.
     * проссматриваем в объединении eyes&mouths
     * для первой проверки можно сделать, что все объекты mouth,
     * процентное величина которых характеризует их нахождения ниже
     * горизонтального центра рассматриваемого face
     *
     * @param eAndM - объединение областей eyes&mouths
     * @param face - рассматриваемая область `лицо`
     */
    var faceVerificationOnFaceArea  = function(eAndM, face){
            //
        var triangleRes = triangle();
        var result = [];
        result.faceVerify = true;
        //console.log("triangleRes = ",triangleRes);
        if(!triangleRes){
            // todo: используем дургие методы.
                var res = 0;
                res = findEye();
                if(!res) {
                    res = findMouth();
                    if(res)
                        result.faceVerify = true;
                }
                else
                    result.faceVerify = true;

        }
        else if(triangleRes == 1){
            // todo: реализовываем алгоритм поиска mouth
            result.faceVerify = true;
        }
        else if(triangleRes == 2)
        {
            // todo: Все ок! Верификация пройдена. Теперь нам надо выйти из функции верификации лица и далее
            result.faceVerify = true;
            // выполнить или добавление person или сопоставить с уже существующими
        }
        result.rects = eAndM;
        return result;

        // метод треугольника
        // todo: необходимо тестирование
        // todo: выполнение и без intersected areas
        function triangle(){
                // в первую очередь нам необходимо удалить все элементы с параметром intersectionWith
            var uniqueRects = deleteAllIntersectedAreas(eAndM);
            //console.log("uniqueRects:", uniqueRects);
                // вычисляем левую половину области лица и правую
            var leftPartOfFace = makeClone(face);
            leftPartOfFace.width = face.width /2;
            var rightPartOfFace = makeClone(leftPartOfFace);
            rightPartOfFace.x+=leftPartOfFace.width;
                // находим области, которые в левой и правой половине
            var areasOfLeftSide = findIntersections(uniqueRects, 60, 100, leftPartOfFace),
                areasOfRightSide = findIntersections(uniqueRects, 60, 100, rightPartOfFace);
            var res = 0;
            areasOfLeftSide.forEach(function cycleLeft(leftRect){
                if(cycleLeft.stop){return;}
                areasOfRightSide.forEach(function cycleRight(rightRect){
                    if(cycleRight.stop){return;}
                    //console.log("widthDiff(leftRect, rightRect): ", widthDiff(leftRect, rightRect));
                    if(widthDiff(leftRect, rightRect)>=50){
                        if(intersectionOy(leftRect, rightRect)>=50){
                                // получается, что это два глаза!!! Мы их нашли
                                // todo: фиксируем их в любом случае!!!!!
                            cycleRight.stop = cycleLeft.stop = true;
                            var leftEyeAreaIndex = equivalentRectIndex(eAndM, leftRect),
                                rightEyeAreaIndex = equivalentRectIndex(eAndM, rightRect);
                            eAndM[leftEyeAreaIndex].facePart = "leftEye";
                            eAndM[rightEyeAreaIndex].facePart = "rightEye";
                            leftEyeAreaIndex = equivalentRectIndex(uniqueRects, leftRect);
                            uniqueRects.splice(leftEyeAreaIndex, 1);
                            rightEyeAreaIndex = equivalentRectIndex(uniqueRects, rightRect);
                            uniqueRects.splice(rightEyeAreaIndex, 1);
                            res++;
                        }
                    }
                });
            });
            if(!res)
                return res;
                // условие верификации лица выполнены
                // осталось найти mouth
                // todo: после тестов необходимо определить, мб buttomSide должен быть строго ниже detected eyes
            var buttomSide = makeClone(face);
            buttomSide.height = face.height/2;
            buttomSide.y += buttomSide.height;
            var suspectedMouths = findIntersections(uniqueRects, 20, 60, buttomSide);
            //console.log("suspectedMouths: ", suspectedMouths, "uniqueRects", uniqueRects);
            if(suspectedMouths.length>1){
                var foundMouthIndex = equivalentRectIndex(eAndM, suspectedMouths[0]);
                eAndM[foundMouthIndex].facePart = "mouth";
                foundMouthIndex = equivalentRectIndex(uniqueRects, suspectedMouths[0]);
                uniqueRects.splice(foundMouthIndex, 1);
                //delete uniqueRects[foundMouthIndex];
                res++;
                // suspectedMouths.forEach(function(susp){
                //         // смотрим, если процент отклонения рта от центра двух глаз менее 31, то
                //         // добавляем данную область
                //     if (procDeviationBetweenEyes(findRectWithFacePart(eAndM, "leftEye")[0],
                //         findRectWithFacePart(eAndM, "rightEye")[0], susp)<31){
                //         var foundMouthIndex = equivalentRectIndex(eAndM, susp);
                //         eAndM[foundMouthIndex].facePart = "mouth";
                //         delete uniqueRects[foundMouthIndex];
                //         res++;
                //     }
                // });
                    // думаю, стоит брать усредненный, гадать не будем
                    // то есть, будем фильтровать. В теории, у нас есть n найденных облестей, из них только одна подойдет
                    // по задаче будем фильтровать по средней высоте глаз и чтобы середина не заходила за "серидины" глаз
                    // алгоритм прост: выбираем ту область, где у нас больше процент близости к центру
                    // между серединами левого глаза и правого

            }
            else if(suspectedMouths.length){
                var foundMouthIndex = equivalentRectIndex(eAndM, suspectedMouths[0]);
                eAndM[foundMouthIndex].facePart = "mouth";
                foundMouthIndex = equivalentRectIndex(uniqueRects, suspectedMouths[0]);
                uniqueRects.splice(foundMouthIndex, 1);
                //delete uniqueRects[foundMouthIndex];
                res++;
            } // на этом ВСЕ в треугольнике!!!!!!!!!
            return res;
        } // --- END triangle()
        function findEye(){
            var intersectedArea = false,
                upperLeftAreaOfFace = makeClone(face);
            upperLeftAreaOfFace.height = face.height/2;
            upperLeftAreaOfFace.width = face.width/2;
            var upperRightAreaOfFace = makeClone(upperLeftAreaOfFace);
            upperRightAreaOfFace.x = face.x + upperLeftAreaOfFace.width;
            eAndM.forEach(function cycle(area){
                if(cycle.stop) return;
                if(area.intersectionWith != undefined) {
                    var intersections = findIntersections([area], 70, 100, upperLeftAreaOfFace);
                    if(intersections.length > 0){
                        var leftEyeAreaIndex = equivalentRectIndex(eAndM, intersections[0]);
                        eAndM[leftEyeAreaIndex].facePart = "leftEye";
                        intersectedArea = true;
                        cycle.stop = true;
                    }
                    else{
                        intersections = findIntersections([area], 70, 100, upperRightAreaOfFace);
                        if(intersections.length > 0){
                            var rightEyeAreaIndex = equivalentRectIndex(eAndM, intersections[0]);
                            eAndM[rightEyeAreaIndex].facePart = "rightEye";
                            intersectedArea = true;
                            cycle.stop = true;
                        }
                    }
                }
            });
            return intersectedArea;
        }
        function findMouth(){
            var res = 0;
            var buttomSide = makeClone(face);
            buttomSide.height = face.height/2;
            buttomSide.y += buttomSide.height;
            var suspectedMouths = findIntersections(eAndM, 20, 60, buttomSide);
            //console.log("suspectedMouths: ", suspectedMouths, "uniqueRects", uniqueRects);
            if(suspectedMouths.length){
                var foundMouthIndex = equivalentRectIndex(eAndM, suspectedMouths[0]);
                eAndM[foundMouthIndex].facePart = "mouth";
                res++;
            }
            return res;
        }
    };
    /**
     * todo: --- to check!
     * Здесь учитываем количество областей, которые имеют
     * пересечения, потому что они будут добавлены, практически,
     * с большой вероятностью.
     * @param rects
     */
    var findEyes = function(rects, face){

    };
        // todo: добавить контроль за persons & suspObjs! по lastActiveTime
    var controller = function(){
        var controllerRes = "";
        //console.log("detection.persons.length = "+detection.persons.length);
        //console.log("detection.updateFrequency = "+detection.updateFrequency);
        //console.log("detection.numOfUpdates = "+detection.numOfUpdates);
        //console.log("detection.updateFrequency = "+detection.updateFrequency);
        if(detection.persons.length <= 2 && detection.doNotRepeatAlert){
            detection.doNotRepeatAlert = false;
            controllerRes = "ONE";
        }

        if(detection.persons.length > 2 && !detection.doNotRepeatAlert) {
            detection.doNotRepeatAlert = true;
            controllerRes = "MORE";
            detection.persons = [];
        }
        detection.persons.forEach(function(person, index){
            person.updateLifeTime();
            if(person.outOfFrame() && detection.persons.length <= 2) {
                controllerRes = "OUT";
                detection.persons.splice(index, 1);
                //console.log("Person deleted");
            }else if(person.outOfFrame() && detection.persons.length > 2){
                detection.persons.splice(index, 1);
                //console.log("Person deleted");
            }

        });
        detection.suspectObjs.forEach(function(suspObj, index){
                if(suspObj.outOfFrame()){
                    detection.suspectObjs.splice(index, 1);
                }
                else if(suspObj.checkLifeTime()){

                }
            });
        return controllerRes;
    };
    /**
     * площадь пересечения двух областей
     * @param point
     * @param i
     * @param xProjectionsArray
     * @param yProjectionsArray
     * @returns {number}
     */
    var intersectionSquare = function(point, i, xProjectionsArray, yProjectionsArray){
        var xLen, yLen;
        if(xProjectionsArray[point]>=xProjectionsArray[i]){
            if(xProjectionsArray[point+1]>=xProjectionsArray[i+1])
                xLen = xProjectionsArray[i+1] - xProjectionsArray[point];
            else
                xLen = xProjectionsArray[point+1] - xProjectionsArray[point];

        }
        else{
            if(xProjectionsArray[point+1]>=xProjectionsArray[i+1])
                xLen = xProjectionsArray[i+1] - xProjectionsArray[i];
            else
                xLen = xProjectionsArray[point+1] - xProjectionsArray[i];
        }
        if(yProjectionsArray[point]>=yProjectionsArray[i]){
            if(yProjectionsArray[point+1]>=yProjectionsArray[i+1])
                yLen = yProjectionsArray[i+1] - yProjectionsArray[point];
            else
                yLen = yProjectionsArray[point+1] - yProjectionsArray[point];

        }
        else{
            if(yProjectionsArray[point+1]>=yProjectionsArray[i+1])
                yLen = yProjectionsArray[i+1] - yProjectionsArray[i];
            else
                yLen = yProjectionsArray[point+1] - yProjectionsArray[i];
        }
        return xLen*yLen;
    };
    /**
     * процент нахождения части (пересечения) одной области в другой
     * формула вычисления: S(ПЕРЕСЕЧЕНИЕ(A,B))/S(A)*100
     * где S() — площадь, A - область, которая пересекает область B.
     * то есть, если S(A)=ПЕРЕСЕЧЕНИЕ(A,B), то percentOfIntersectionSq() вернет 100
     * @param sq
     * @param point
     * @param i
     * @param xProjectionsArray
     * @param yProjectionsArray
     * @returns {number}
     */
    var percentOfIntersectionSq = function (sq,point, i, xProjectionsArray, yProjectionsArray){
        var sqA, sqB;
        sqA = (xProjectionsArray[point+1]-xProjectionsArray[point])*
            (yProjectionsArray[point+1]-yProjectionsArray[point]);
        sqB = (xProjectionsArray[i+1]-xProjectionsArray[i])*
            (yProjectionsArray[i+1]-yProjectionsArray[i]);
        return (sq/sqA)*100;
    }
	var uniqueAreaIndex = function(A){
		var n = A.length, k = 0, B = [];
		for(var i = 0; i < n; i++) {
		    if(!A[i])
		        continue;
            for (var j = i; j < n; j++) {
                if (!odd(A[i]) && A[i] + 1 == A[j])
                    delete A[j];
            }
        B.push(A[i]);
        }


		return B;
	};
    var onlyFirstValue = function(A){
        var n = A.length, k = 0, B = [];
        for(var i = 0; i<n; i++)
            if(odd(A[i]))
                A[i] = A[i]-1;
        return A;
    };
        // возвращает rect с аналогичными параметарми. Нужен для того,
        // чтобы не потерять другие свойства объектов-областей.
	var rectEquivalent = function(rects, x, y, w, h){
	    if(x == undefined || y == undefined || w == undefined || h == undefined)
	        return;
	    var result;
		rects.forEach(function cycle(rect){
            if(cycle.stop || rect == undefined){ return; }
			if(rect.x == x && rect.y == y && rect.width == w && rect.height == h){
                result = rect;
                cycle = true;
            }
		});
		return result;
	};
	var equivalenRect = function(rects, find){
	    return rectEquivalent(rects, find.x, find.y, find.width, find.height);
    };
	var equivalentRectIndex = function(rects, find){
        var result = -1;
        rects.forEach(function cycle(rect, index){
            if(cycle.stop){ return; }
            if(rect.x == find.x && rect.y == find.y && rect.width == find.width && rect.height == find.height){
                result = index;
                cycle = true;
            }
        });
        return result;
    };
        // проверка на нечетность
    var odd = function(number){return number%2;};
        // удаление повторяющихся элементов
    var unique = function (A){
        var n = A.length, k = 0, B = [];
        for (var i = 0; i < n; i++)
        { var j = 0;
            while (j < k && B[j] !== A[i]) j++;
            if (j == k) B[k++] = A[i];
        }
        return B;
    };
        // поиск и удаление областей с заданным типом
        // возвращается эта найденная область
        // !!! удаляется только первый найденный элемент
        // !!! для удаления всех таких областей есть deleteAllRectsWithType()
    var deleteArea = function(rects, find){
        var index = equivalentRectIndex(rects, find);
        rects.splice(index,1);
        return rects;
    }
    var findAreaAndDelete = function(rects, type){
        var result;
        rects.forEach(function cycle(rect, index){
            if(cycle.stop){return;}
            if(rect.typeOfArea == type){
                delete rects[index];
                result = rect;
                cycle.stop = true;
            }
        });
        return result;
    };
        // поиск и удаление ВСЕХ областей с заданным типом
    var deleteAllRectsWithType = function(rects, type){
        var res = [];
        rects.forEach(function(rect){
            if(rect.typeOfArea != type)
                res.push(makeClone(rect));
        });
        return res;
    };
        // функция удаления областей, имеющих свойство intersectionWith
    var deleteAllIntersectedAreas = function (rects){
        var res = [];
        rects.forEach(function(rect){
            if(rect.intersectionWith == undefined)
                res.push(makeClone(rect));
        });
        return res;
    };
    var updateRects = function(original, updated){
        original.forEach(function(origRect, index){
            var res = rectEquivalent(updated, origRect.x, origRect.y, origRect.width, origRect.height);
            if(res != undefined)
                //original[index] = res;
                for (var key in res)
										if(origRect[key] !== undefined)
                    		origRect[key] = res[key];
        });
        return original;
    };
        // функция возвращает процент, на который различаются width областей
    var widthDiff = function(a,b){
        if(a.width<b.width){
            //  меняем местами
            var tmp = a;
            a = b;
            b = tmp;
        }
        return (b.width/a.width)*100;
        // var length = 0;
        // if(b.x >= a.x){
        //     if(b.x2 >= a.x2) {
        //         // 3 случай
        //         length = a.x2 - b.x;
        //
        //     }
        //     else
        //         // 1 случай
        //         length = b.width;
        // }
        // else{
        //     if(b.x2 <= a.x2) {
        //         // 2 случай
        //         length = b.x2 - a.x;
        //         console.log("2 случай");
        //     }
        //     else
        //         length = a.width;
        // }
        // console.log(length);
        // return (length/a.width)*100;
    };
        // функция вычисляет процент отклонения от центра между двумя глазами
    var procDeviationBetweenEyes = function(leftEye, rightEye, suspectedMouth){
            // вычисляем центры
        if(leftEye != undefined)
            leftEye.center.x = leftEye.x + leftEye.width/2;
        if(rightEye != undefined)
            rightEye.center.x = rightEye.x + rightEye.width/2;
        var center = (rightEye.center.x - leftEye.center.x)/2;
        suspectedMouth.center.x = suspectedMouth.x + suspectedMouth.width/2;
        return Math.abs(suspectedMouth.x-center.x)/(center.x - leftEye.center.x)*100;
    };
        // возвращаем области с facePart
        // todo: исправить данный метод!!!!
    var findRectWithFacePart = function(rects, facePart){
        var result = [];
        rects.forEach(function(rect){
            if(rect.facePart == facePart)
                result.push(rect);
        });
        //console.log("findRectWithFacePart: ", result);
        return result;
    };
    var makeArrayClone = function(from, to){
        to = to || [];
        from.forEach(function(element){
            to.push(makeClone(element));
        });
        return to;
    };
    var makeClone = function(from, to){
        to = to || {};
        for (var key in from)
            to[key] = from[key];
        return to;
    };

        // процент пересечения одной области другой
    var intersectionOy = function(a,b){
        a.y2 = a.y + a.height;
        b.y2 = b.y + b.height;
        if(a.height<b.height){
            //  меняем местами
            var tmp = a;
            a = b;
            b = tmp;
        }
        var length = 0;
        if(b.y >= a.y){
            if(b.y2 >= a.y2) {
                // 3 случай
                length = a.y2 - b.y;

            }
            else
                // 1 случай
                length = b.height;
        }
        else{
            if(b.y2 <= a.y) {
                // 2 случай
                length = b.y2 - a.y;
                //console.log("2 случай");
            }
            else
                length = a.height;
        }
        //console.log(length);
        return (length/a.height)*100;
    };
	detection.addRect = function(x, y, width, heigth){};
	detection.findPerson = function(){};
} (window));